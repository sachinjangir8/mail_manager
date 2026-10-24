import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { NextFunction, Request, Response, Router } from "express";
import { env } from "../../config/env";
import { emailQueue } from "../../queues/emailQueue";

export function setupQueueDashboard(): Router {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/api/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  const dashboardRouter = Router();

  // Basic authentication guard for Bull Board
  dashboardRouter.use((req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="ReachInbox BullMQ Dashboard"');
      res.status(401).send("Authentication required for BullMQ Dashboard");
      return;
    }

    const credentials = Buffer.from(authHeader.split(" ")[1], "base64").toString("utf-8");
    const [user, pass] = credentials.split(":");

    if (user === env.ADMIN_USERNAME && pass === env.ADMIN_PASSWORD) {
      next();
    } else {
      res.setHeader("WWW-Authenticate", 'Basic realm="ReachInbox BullMQ Dashboard"');
      res.status(401).send("Invalid credentials");
    }
  });

  dashboardRouter.use("/", serverAdapter.getRouter());

  return dashboardRouter;
}
