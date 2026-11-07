# Bhumi Landmarks — Admin Backend API

Base URL: `http://localhost:4001/api/v1` (dev)
Auth: `Authorization: Bearer <accessToken>` on every endpoint except login/refresh/logout/health.

## Conventions

- **Money** is always a JSON **string with 2 decimal places** (`"1250000.50"`) so no
  precision is ever lost. Accepts numbers or decimal strings on input.
- **List envelope**: `{ "data": [...], "meta": { page, pageSize, total, totalPages } }`.
- **Single resource**: the object itself. `201` on create, `200` on update.
- **Error envelope**: `{ "error": { "code", "message", "details?" } }` with codes:
  `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
  `CONFLICT` / `DUPLICATE_REFERENCE` (409), `RATE_LIMITED` (429), `INTERNAL` (500).
- **Roles**: `SUPER_ADMIN` (system-wide) and `USER` (only projects assigned via
  `project_user`). Authorization is resolved server-side from the session; roles/ids
  sent by the client are never trusted.
- **Enums** (validated strings): role `SUPER_ADMIN|USER`; status `ACTIVE|CANCELLED`
  (records) / `VALID|VOID` (payments) / `ISSUED|CANCELLED` (invoices) / `ISSUED`
  (receipts); method `CASH|BANK|CHEQUE|ONLINE|OTHER`.
- Every mutation writes an **audit_logs** row; every business change writes
  **record_history** rows (per-field old/new values).

## Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` → `{ user, accessToken }` + httpOnly `refreshToken` cookie (path `/api/v1/auth`). Rate-limited per email+ip (`LOGIN_MAX_ATTEMPTS`). |
| POST | `/auth/refresh` | Cookie (or `{ refreshToken }`) → new access token, **rotates** refresh token; reuse of a rotated token revokes the whole family. |
| POST | `/auth/logout` | Revokes the refresh token, clears cookie. |
| GET | `/auth/me` | Current user profile. |

Access tokens live `ACCESS_TOKEN_TTL` (default 15m). A password change
immediately invalidates all tokens issued before it.

## Users — super admin only

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/users` | `{ name, email, password, role? }` (password ≥ 8 chars) |
| GET | `/users` | `?page&pageSize&search&role&isActive` |
| GET | `/users/:id` | |
| PATCH | `/users/:id` | `{ name?, email?, role? }` — self role-change blocked |
| PATCH | `/users/:id/status` | `{ isActive }` — self-deactivation and last-active-super-admin blocked; deactivation revokes sessions |
| PATCH | `/users/:id/password` | `{ password }` — revokes all sessions of that user |
| GET | `/users/dropdown` | Active users `{ id, name, email, role, isActive }` sorted by name |

## Projects

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/projects` | any | `?page&pageSize&search&isActive` — scoped for USER |
| GET | `/projects/dropdown` | any | Active, scoped for USER |
| GET | `/projects/:id` | any | |
| POST | `/projects` | SA | `{ name, code, description?, location? }` — unique code |
| PATCH | `/projects/:id` | SA | partial update |
| PATCH | `/projects/:id/status` | SA | `{ isActive }` |
| GET | `/projects/:id/users` | SA | assignments |
| POST | `/projects/:id/users` | SA | `{ userIds: [...] }` (add) |
| PUT | `/projects/:id/users` | SA | `{ userIds: [...] }` (replace) |
| DELETE | `/projects/:id/users/:userId` | SA | remove one grant |

## Categories

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/categories` | any | `?page&pageSize&search&isActive` |
| GET | `/categories/dropdown` | any | Active only |
| GET | `/categories/:id` | any | |
| POST | `/categories` | SA | `{ name, description? }` — case-insensitive unique name |
| PATCH | `/categories/:id` | SA | |
| PATCH | `/categories/:id/status` | SA | `{ isActive }` |

## Financial records

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/financial-records` | SA + granted USER | `{ title, partyName, partyPhone?, description?, projectId, categoryId, totalAmount }` — project/category must be active; sequential code `FIN-YYYY-NNNNNN` |
| GET | `/financial-records` | scoped | `?page&pageSize&search&projectId&categoryId&status&dateFrom&dateTo&sortBy&sortDir` |
| GET | `/financial-records/:id` | scoped | includes `paidAmount`, `remainingAmount`, `paymentCount`, project/category/createdBy |
| PATCH | `/financial-records/:id` | scoped | partial; cancelled records must be reactivated first; per-field history |
| PATCH | `/financial-records/:id/status` | scoped | `{ status: "ACTIVE"\|"CANCELLED" }` |
| GET | `/financial-records/:id/history` | scoped | record_history rows (old/new values, actor) |
| POST | `/financial-records/:id/payments` | scoped | `{ amount, paidAt?, method?, reference?, note? }` → `{ transaction, recordSummary }`. 409 `DUPLICATE_REFERENCE` if `reference` already used on this record (prevents double-submission) |
| GET | `/financial-records/:id/transactions` | scoped | newest first, paginated |

**Balance formula**: `remainingAmount = totalAmount − Σ(valid PAYMENT transactions)`.
Voided payments never count. Cancelled records refuse new payments.

## Transactions

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/transactions` | scoped | `?page&pageSize&projectId&financialRecordId&method&status&createdById&search&dateFrom&dateTo` |
| GET | `/transactions/:id` | scoped | includes record + project summary |
| POST | `/transactions/:id/void` | scoped | `{ reason }` (required) — row is **never deleted**, only marked `VOID` with who/when/why |

## Invoices & receipts

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/invoices` | scoped | `{ financialRecordId, items: [{ description, quantity?, unitPrice }], dueDate?, notes? }` — sequential `INV-YYYY-NNNNNN`; party/project/category/record snapshots are frozen at issue time |
| POST | `/invoices/receipts` | scoped | `{ transactionId }` — sequential `RCP-YYYY-NNNNNN`; one receipt per payment; refuses void payments |
| GET | `/invoices` | scoped | `?page&pageSize&type&status&financialRecordId&projectId&search&dateFrom&dateTo` |
| GET | `/invoices/:id` | scoped | includes items |
| GET | `/invoices/:id/pdf` | scoped | `application/pdf` |
| POST | `/invoices/:id/cancel` | scoped | `{ reason }` — status `CANCELLED`, row preserved |

There is no update endpoint: issued documents are historical and immutable
except for cancellation.

## Dashboard

`GET /dashboard` — role-aware:

```json
{
  "role": "SUPER_ADMIN",
  "counts": { "users": { "total": 3, "active": 2 } | null,
              "projects": { "total": 2, "active": 2 },
              "categories": { "total": 2, "active": 2 } },
  "financial": { "totalAmount", "totalPaidAmount", "totalRemainingAmount", "activeRecordCount" },
  "recentTransactions": [ { "id", "amount", "paidAt", "method", "status", "financialRecord", "createdBy" } ],
  "projectSummaries":  [ { "project", "recordCount", "totalAmount", "paidAmount", "remainingAmount" } ],
  "categorySummaries": [ ... ]
}
```

`users` counts are `null` for regular users; everything is scoped to the user's
assigned projects. Cancelled records are excluded from financial totals.

## Reports

All accept `?from&to&projectId&format=json|pdf|xlsx` (PDF `application/pdf`,
Excel `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`),
and are scoped like every other endpoint.

| Path | JSON shape |
| --- | --- |
| `/reports/date-wise` | `{ rows: [{ date, transactionCount, total }] }` |
| `/reports/user-wise` | `{ rows: [{ user, transactionCount, total }] }` (by who recorded the payment) |
| `/reports/project-wise` | `{ rows: [{ project, recordCount, totalAmount, paidAmount, remainingAmount }] }` |
| `/reports/category-wise` | same, per category |
| `/reports/financial-summary` | `{ totals: { totalAmount, totalPaidAmount, totalRemainingAmount, activeRecordCount }, byMethod: [{ method, count, total }] }` |
| `/reports/transactions` | `{ rows, meta }` — filters: `?method&status&createdById&search&page&pageSize` |

Reports consider **valid payments only** unless `status` is overridden on
`/reports/transactions`.

## Example session

```bash
BASE=http://localhost:4001/api/v1
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@bhumilandmarks.com","password":"ChangeMe!123"}' \
  | jq -r .accessToken)

curl -s $BASE/dashboard -H "Authorization: Bearer $TOKEN" | jq
curl -s "$BASE/reports/project-wise?format=xlsx" -H "Authorization: Bearer $TOKEN" -o project-wise.xlsx
```
