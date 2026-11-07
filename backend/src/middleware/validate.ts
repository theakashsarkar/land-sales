import type { Request } from "express";
import type { RequestHandler } from "express";
import type { z } from "zod";
import { AppError } from "../lib/errors.js";

function zodToAppError(error: z.ZodError): AppError {
  return new AppError(400, "VALIDATION_ERROR", "Invalid request", error.flatten());
}

const VALIDATED = Symbol("validated");

interface ValidatedBag {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

function bag(req: Request): ValidatedBag {
  const reqAny = req as unknown as { [VALIDATED]?: ValidatedBag };
  reqAny[VALIDATED] ??= {};
  return reqAny[VALIDATED]!;
}

export function validateBody(schema: z.ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(zodToAppError(result.error));
    req.body = result.data;
    bag(req).body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(zodToAppError(result.error));
    bag(req).query = result.data;
    next();
  };
}

export function validateParams(schema: z.ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return next(zodToAppError(result.error));
    bag(req).params = result.data;
    next();
  };
}

export function validatedBody<T>(req: Request): T {
  return bag(req).body as T;
}

export function validatedQuery<T>(req: Request): T {
  return bag(req).query as T;
}

export function validatedParams<T>(req: Request): T {
  return bag(req).params as T;
}
