import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateQuery, validatedQuery } from "../../middleware/validate.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import * as reports from "./service.js";
import type { ExportFormat } from "./service.js";
import { reportQuerySchema } from "./schemas.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

type Query = {
  from?: string;
  to?: string;
  projectId?: string;
  format?: "json" | "pdf" | "xlsx";
  page?: number;
  pageSize?: number;
  method?: string;
  status?: string;
  createdById?: string;
  search?: string;
};

function slugWithPeriod(name: string, q: Query): string {
  const period = q.from || q.to ? `_${q.from ?? "start"}_${q.to ?? "today"}` : "";
  return `${name}${period}_${new Date().toISOString().slice(0, 10)}`;
}

async function send(res: import("express").Response, result: { table: reports.ReportTable; json: unknown }, slug: string, format: "json" | "pdf" | "xlsx") {
  if (format === "json") {
    res.json(result.json);
    return;
  }
  const { buffer, contentType, filename } = await reports.renderTable(result.table, format as ExportFormat, slug);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

function reportHandler(
  name: string,
  fn: (actor: import("../../types.js").AuthUser, q: Query) => Promise<{ table: reports.ReportTable; json: unknown }>,
) {
  return asyncHandler(async (req, res) => {
    const q = validatedQuery<Query>(req);
    const result = await fn(req.user!, q);
    await send(res, result, slugWithPeriod(name, q), q.format ?? "json");
  });
}

reportsRouter.get("/date-wise", validateQuery(reportQuerySchema), reportHandler("date-wise", reports.dateWiseReport));

reportsRouter.get("/user-wise", validateQuery(reportQuerySchema), reportHandler("user-wise", reports.userWiseReport));

reportsRouter.get("/project-wise", validateQuery(reportQuerySchema), reportHandler("project-wise", reports.projectWiseReport));

reportsRouter.get("/category-wise", validateQuery(reportQuerySchema), reportHandler("category-wise", reports.categoryWiseReport));

reportsRouter.get(
  "/financial-summary",
  validateQuery(reportQuerySchema),
  reportHandler("financial-summary", reports.financialSummaryReport),
);

reportsRouter.get(
  "/transactions",
  validateQuery(reportQuerySchema),
  reportHandler("transactions", reports.transactionsReport),
);

reportsRouter.use((_req, _res, next) => next(AppError.notFound("Report")));
