import { AppError } from "./errors.js";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePagination(query: { page?: unknown; pageSize?: unknown }): Pagination {
  const page = parsePositiveInt(query.page, "page", 1);
  const pageSize = parsePositiveInt(query.pageSize, "pageSize", DEFAULT_PAGE_SIZE);
  if (pageSize > MAX_PAGE_SIZE) {
    throw AppError.badRequest(`pageSize must be at most ${MAX_PAGE_SIZE}`);
  }
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function pageMeta(total: number, page: number, pageSize: number): PageMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function pageResult<T>(data: T[], total: number, page: number, pageSize: number) {
  return { data, meta: pageMeta(total, page, pageSize) };
}

function parsePositiveInt(value: unknown, name: string, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw AppError.badRequest(`${name} must be a positive integer`);
  }
  return n;
}
