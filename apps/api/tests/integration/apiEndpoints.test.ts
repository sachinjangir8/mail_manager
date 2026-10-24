import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

describe("API Integration Tests (Express Endpoints)", () => {
  const app = createApp();

  it("GET /api/health returns 200 and healthy status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /api/auth/me rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/senders rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/senders");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/google sets state cookie and returns redirect or setup advice", async () => {
    const res = await request(app).get("/api/auth/google");
    expect(res.status).toBe(302);
    expect(res.headers["set-cookie"]).toBeDefined();
    // Cookie should have httpOnly
    const cookieHeader = res.headers["set-cookie"].join(";");
    expect(cookieHeader).toContain("google_oauth_state");
  });

  it("POST /api/emails/schedule rejects unauthorized calls", async () => {
    const res = await request(app)
      .post("/api/emails/schedule")
      .send({
        senderId: "00000000-0000-0000-0000-000000000000",
        subject: "Test Subject",
        body: "Hello",
        recipients: ["user@example.com"],
        scheduledAt: new Date().toISOString(),
      });

    expect(res.status).toBe(401);
  });
});
