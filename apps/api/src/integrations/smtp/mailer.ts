import nodemailer, { Transporter } from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

export interface SendMailOptions {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

class MailService {
  private defaultTransporter: Transporter | null = null;
  private testAccount: nodemailer.TestAccount | null = null;

  /**
   * Initializes default Ethereal test transporter
   */
  public async initDefaultTransporter(): Promise<Transporter> {
    if (this.defaultTransporter) {
      return this.defaultTransporter;
    }

    let host = env.ETHEREAL_SMTP_HOST;
    let port = env.ETHEREAL_SMTP_PORT;
    let user = env.ETHEREAL_SMTP_USER;
    let pass = env.ETHEREAL_SMTP_PASS;

    if (!user || !pass) {
      try {
        logger.info("Generating automatic Nodemailer Ethereal test account...");
        this.testAccount = await nodemailer.createTestAccount();
        host = this.testAccount.smtp.host;
        port = this.testAccount.smtp.port;
        user = this.testAccount.user;
        pass = this.testAccount.pass;
        logger.info(
          { user: this.testAccount.user, web: this.testAccount.web },
          "Ethereal test account generated successfully"
        );
      } catch (err) {
        logger.warn({ err }, "Could not generate Ethereal account, falling back to dummy credentials");
        user = "test@ethereal.email";
        pass = "testpass";
      }
    }

    this.defaultTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    return this.defaultTransporter;
  }

  public async getTestAccount(): Promise<nodemailer.TestAccount | null> {
    if (!this.testAccount) {
      try {
        this.testAccount = await nodemailer.createTestAccount();
      } catch {
        return null;
      }
    }
    return this.testAccount;
  }

  /**
   * Sends an email through Nodemailer
   */
  public async sendEmail(options: SendMailOptions): Promise<SendMailResult> {
    let transporter: Transporter;

    if (options.smtpConfig && options.smtpConfig.user && options.smtpConfig.pass) {
      transporter = nodemailer.createTransport({
        host: options.smtpConfig.host,
        port: options.smtpConfig.port,
        secure: options.smtpConfig.port === 465,
        auth: {
          user: options.smtpConfig.user,
          pass: options.smtpConfig.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    } else {
      transporter = await this.initDefaultTransporter();
    }

    try {
      const info = await transporter.sendMail({
        from: `"${options.fromName}" <${options.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.body,
        text: options.body.replace(/<[^>]*>?/gm, ""), // strip tags for text fallback
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(
        {
          messageId: info.messageId,
          to: options.to,
          previewUrl: previewUrl || undefined,
        },
        "Email delivered to SMTP transport"
      );

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err, to: options.to }, "SMTP send failed");
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}

export const mailService = new MailService();
