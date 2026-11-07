# Bhumi Landmarks — Admin Backend

Production-grade REST backend for the management system: authentication with
roles, users, projects, categories, financial records with payments, immutable
transaction history, invoices/receipts with PDF generation, dashboards, and
reports with PDF/Excel exports.

**This service is fully independent of the public marketing site** (`../server`,
`../client`), which remains untouched and keeps serving visitors. The two can
run side by side: marketing site on `:4000`, admin API on `:4001`.

## Stack

- Node.js + TypeScript + Express 4
- Prisma ORM — SQLite by default, schema is **Postgres-ready** (Decimal money
  columns, no SQLite-only features; switch provider + `DATABASE_URL` and re-migrate)
- Zod validation on every boundary; strict schemas reject unknown fields
- JWT access tokens (short-lived) + rotating refresh tokens (hashed at rest,
  httpOnly cookie, reuse detection revokes the session family)
- bcryptjs password hashing; per-email+ip login throttling
- pdfkit (invoices/receipts/report PDFs) and exceljs (XLSX exports)
- Vitest + Supertest — 124 integration/e2e tests against a real database

## Quick start

```bash
cd backend
npm install
cp .env.example .env            # then edit: generate secrets with `openssl rand -hex 32`
npx prisma migrate deploy       # create schema
npm run db:seed                 # create the super admin from .env
npm run dev                     # http://localhost:4001
```

Default seeded login (change immediately in any real deployment):
`admin@bhumilandmarks.com` / `ChangeMe!123`

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Watch-mode dev server (`:4001`) |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm test` | Full test suite (fresh DB per run, sequential) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create/apply a dev migration (`prisma migrate dev`) |
| `npm run db:deploy` | Apply migrations without prompts (CI/prod) |
| `npm run db:seed` | Seed the super admin (idempotent) |

## Environment

See `.env.example`. Key variables: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET` (32+ chars each), `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`,
`CORS_ORIGIN` (comma-separated origins of the admin SPA), `SUPER_ADMIN_*` seed
values. `.env`, `*.db` are git-ignored.

## Architecture

```
src/
  app.ts                  express factory, mounts all module routers under /api/v1
  server.ts               bootstrap + graceful shutdown
  config/env.ts           zod-validated environment
  lib/                    prisma client, errors, money (Decimal), pagination,
                          codes (FIN-/INV- numbering), audit, history, access
                          (project scoping), tokens, login throttle, PDF/Excel
  middleware/             requireAuth / requireRole, zod validation, error handler
  modules/
    auth/  users/  projects/  categories/
    financial-records/  transactions/  invoices/
    dashboard/  reports/
prisma/
  schema.prisma           users, projects, categories, project_user,
                          financial_records, transactions, record_history,
                          invoices, invoice_items, audit_logs, refresh_tokens
  migrations/             versioned SQL migrations
tests/                    vitest suites (TDD): one per module + security,
                          cross-user isolation and a full e2e workflow
docs/API.md               complete endpoint documentation
```

## Money correctness

All amounts are Prisma `Decimal`, normalized to 2 decimal places (half-up)
before persistence and serialized as fixed 2dp strings in JSON. Balances are
computed as `totalAmount − Σ(valid payments)` inside database transactions.
Duplicate payment submissions are rejected via a per-record unique `reference`
(`409 DUPLICATE_REFERENCE`). Payments are never deleted — corrections void them,
preserving who/when/why.

## Security model

- `SUPER_ADMIN`: full access, including user administration.
- `USER`: read/write only on records of projects granted via `project_user`
  (checked server-side on every request; list queries are scope-filtered so no
  cross-tenant rows can leak, and explicit filters outside the scope are 403).
- Access-token role claims are never trusted — the role is re-read from the DB
  on every request; deactivation and password changes kill sessions immediately.
- All mutations append to `audit_logs`; business changes append per-field
  old/new rows to `record_history`.

## Deployment notes

- Any Node 20+ host works (the service is stateless apart from the SQLite file
  — for multi-instance deployments switch to PostgreSQL first).
- Serve behind HTTPS; cookies are `secure` in production. Set `CORS_ORIGIN` to
  the admin SPA origin.
- Take the SQLite file backup schedule seriously; on Postgres use managed
  backups. Historical/audit tables are append-only by contract.
