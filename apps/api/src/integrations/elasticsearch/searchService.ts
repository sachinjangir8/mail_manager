import { Client } from "@elastic/elasticsearch";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { logger } from "../../utils/logger";

export interface IndexEmailDocument {
  id: string;
  userId: string;
  campaignId: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  status: string;
  scheduledTime: string;
  sentTime?: string | null;
  createdAt: string;
}

export interface SearchEmailParams {
  userId: string;
  query?: string;
  status?: string;
  senderId?: string;
  campaignId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class ElasticsearchService {
  private client: Client;
  private isConnected = false;
  private hasCheckedConnection = false;

  constructor() {
    this.client = new Client({
      node: env.ELASTICSEARCH_URL,
      maxRetries: 2,
      requestTimeout: 3000,
    });
  }

  /**
   * Initializes Elasticsearch index with mappings if available
   */
  public async initIndex(): Promise<boolean> {
    try {
      const ping = await this.client.ping();
      this.isConnected = ping;
      this.hasCheckedConnection = true;

      if (!this.isConnected) {
        logger.warn("Elasticsearch ping returned false; using database fallback for search");
        return false;
      }

      const indexExists = await this.client.indices.exists({
        index: env.ELASTICSEARCH_INDEX,
      });

      if (!indexExists) {
        logger.info({ index: env.ELASTICSEARCH_INDEX }, "Creating Elasticsearch index with mappings");
        await this.client.indices.create({
          index: env.ELASTICSEARCH_INDEX,
          mappings: {
            properties: {
              id: { type: "keyword" },
              userId: { type: "keyword" },
              campaignId: { type: "keyword" },
              senderId: { type: "keyword" },
              senderEmail: { type: "keyword" },
              recipientEmail: { type: "keyword" },
              subject: { type: "text" },
              status: { type: "keyword" },
              scheduledTime: { type: "date" },
              sentTime: { type: "date" },
              createdAt: { type: "date" },
            },
          },
        });
      }

      return true;
    } catch (err: unknown) {
      this.isConnected = false;
      this.hasCheckedConnection = true;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err: msg }, "Elasticsearch unavailable at startup; searches will use DB fallback");
      return false;
    }
  }

  /**
   * Idempotently indexes or updates an email record
   */
  public async indexEmail(doc: IndexEmailDocument): Promise<void> {
    try {
      if (!this.hasCheckedConnection) {
        await this.initIndex();
      }

      if (!this.isConnected) {
        // Record indexing outbox event so it can be re-synced when ES is available
        await prisma.outboxEvent.create({
          data: {
            aggregateType: "ELASTICSEARCH_INDEX",
            aggregateId: doc.id,
            eventType: "INDEX_EMAIL",
            payload: JSON.stringify(doc),
            status: "PENDING",
          },
        });
        return;
      }

      await this.client.index({
        index: env.ELASTICSEARCH_INDEX,
        id: doc.id,
        document: doc,
        refresh: true, // ensure immediate searchability
      });
    } catch (err: unknown) {
      logger.warn({ err, emailId: doc.id }, "Elasticsearch indexing error; persisting outbox record");
      try {
        await prisma.outboxEvent.create({
          data: {
            aggregateType: "ELASTICSEARCH_INDEX",
            aggregateId: doc.id,
            eventType: "INDEX_EMAIL",
            payload: JSON.stringify(doc),
            status: "PENDING",
            lastError: err instanceof Error ? err.message : String(err),
          },
        });
      } catch {
        // Ignore duplicate outbox insertion
      }
    }
  }

  /**
   * Searches email records with multi-match queries, filters, and pagination
   * Falls back seamlessly to PostgreSQL if Elasticsearch is not reachable.
   */
  public async searchEmails(params: SearchEmailParams) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    // Check if ES is available
    if (this.isConnected) {
      try {
        const mustClauses: any[] = [{ term: { userId: params.userId } }];

        if (params.query && params.query.trim().length > 0) {
          mustClauses.push({
            multi_match: {
              query: params.query,
              fields: ["subject^2", "recipientEmail", "senderEmail"],
              fuzziness: "AUTO",
            },
          });
        }

        if (params.status) {
          mustClauses.push({ term: { status: params.status } });
        }

        if (params.senderId) {
          mustClauses.push({ term: { senderId: params.senderId } });
        }

        if (params.campaignId) {
          mustClauses.push({ term: { campaignId: params.campaignId } });
        }

        if (params.startDate || params.endDate) {
          const rangeQuery: any = {};
          if (params.startDate) rangeQuery.gte = params.startDate;
          if (params.endDate) rangeQuery.lte = params.endDate;
          mustClauses.push({ range: { scheduledTime: rangeQuery } });
        }

        const response = await this.client.search({
          index: env.ELASTICSEARCH_INDEX,
          from: skip,
          size: limit,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          sort: [{ scheduledTime: "desc" }],
        });

        const hits = response.hits.hits;
        const total = typeof response.hits.total === "number" ? response.hits.total : response.hits.total?.value || 0;
        const items = hits.map((h: any) => h._source);

        return {
          source: "elasticsearch",
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      } catch (err: unknown) {
        logger.warn({ err }, "Elasticsearch search query failed; falling back to PostgreSQL");
      }
    }

    // High-performance PostgreSQL Fallback Search
    const whereClause: any = {
      userId: params.userId,
    };

    if (params.query && params.query.trim().length > 0) {
      const q = params.query.trim();
      whereClause.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { recipientEmail: { contains: q, mode: "insensitive" } },
      ];
    }

    if (params.status) {
      whereClause.status = params.status;
    }

    if (params.senderId) {
      whereClause.senderId = params.senderId;
    }

    if (params.campaignId) {
      whereClause.campaignId = params.campaignId;
    }

    if (params.startDate || params.endDate) {
      whereClause.scheduledTime = {};
      if (params.startDate) whereClause.scheduledTime.gte = new Date(params.startDate);
      if (params.endDate) whereClause.scheduledTime.lte = new Date(params.endDate);
    }

    const [total, records] = await Promise.all([
      prisma.scheduledEmail.count({ where: whereClause }),
      prisma.scheduledEmail.findMany({
        where: whereClause,
        orderBy: { scheduledTime: "desc" },
        skip,
        take: limit,
        include: { sender: { select: { email: true, displayName: true } } },
      }),
    ]);

    const items = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      campaignId: r.campaignId,
      senderId: r.senderId,
      senderEmail: r.sender.email,
      recipientEmail: r.recipientEmail,
      subject: r.subject,
      status: r.status,
      scheduledTime: r.scheduledTime.toISOString(),
      sentTime: r.sentTime ? r.sentTime.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      source: "postgresql_fallback",
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Reindexes or repairs missing documents from Postgres to Elasticsearch
   */
  public async syncPendingOutbox(): Promise<number> {
    if (!this.isConnected) return 0;

    const pending = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: "ELASTICSEARCH_INDEX",
        status: "PENDING",
      },
      take: 50,
    });

    let synced = 0;
    for (const event of pending) {
      try {
        const doc = JSON.parse(event.payload);
        await this.client.index({
          index: env.ELASTICSEARCH_INDEX,
          id: doc.id,
          document: doc,
        });

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
        synced++;
      } catch (err: unknown) {
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            retryCount: { increment: 1 },
            lastError: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    return synced;
  }
}

export const searchService = new ElasticsearchService();
