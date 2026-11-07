import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/routes.js";
import { usersRouter } from "./modules/users/routes.js";
import { projectsRouter } from "./modules/projects/routes.js";
import { categoriesRouter } from "./modules/categories/routes.js";
import { financialRecordsRouter } from "./modules/financial-records/routes.js";
import { transactionsRouter } from "./modules/transactions/routes.js";
import { invoicesRouter } from "./modules/invoices/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";

const API_PREFIX = "/api/v1";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get(`${API_PREFIX}/health`, (_req, res) => {
    res.json({ ok: true, service: "bhumilandmarks-backend", time: new Date().toISOString() });
  });

  // Module routers are mounted here as they are implemented.
  const api = express.Router();
  api.use("/auth", authRouter);
  api.use("/users", usersRouter);
  api.use("/projects", projectsRouter);
  api.use("/categories", categoriesRouter);
  api.use("/financial-records", financialRecordsRouter);
  api.use("/transactions", transactionsRouter);
  api.use("/invoices", invoicesRouter);
  api.use("/dashboard", dashboardRouter);
  api.use("/reports", reportsRouter);
  app.use(API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
