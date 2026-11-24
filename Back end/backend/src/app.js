import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientUrls, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.get("/api/health", (_req, res) => res.json({ success: true, status: "ok", time: new Date().toISOString() }));
  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
