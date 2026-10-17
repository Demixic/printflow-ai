# PrintFlow AI

Production dashboard for print-shop operations: orders, deadlines and a ranked
production-priority queue. Built with Next.js (App Router, Cache Components),
TypeScript, Tailwind CSS, PostgreSQL and Prisma.

## Requirements

- Node.js 20.19+ (developed on Node 26)
- PostgreSQL 14+ — local via Docker (`docker-compose.yml`, needs Docker
  Desktop or Docker Engine with Compose), or any hosted Postgres such as
  Neon / Vercel Postgres
- Optional: a Gemini API key for the AI Operations Brief

## Setup

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then edit DATABASE_URL if not using docker-compose
npm run db:up               # optional: start local Postgres 17 in Docker
npm run db:migrate          # apply migrations (prisma migrate dev)
npm run db:seed             # load the 18 demo orders (safe to re-run)
npm run auth:secret         # paste the output into AUTH_SECRET in .env
npm run auth:hash-password  # prompts for an editor password; paste into EDITOR_PASSWORD_HASH
                            # and set EDITOR_USERNAME (e.g. "editor") in .env
npm run dev                 # http://localhost:3000 → sign-in page
```

The seed recreates the demo orders with due dates relative to today, so the
dashboard always shows a realistic mix of overdue, due-today and upcoming work.
Re-running it resets the demo orders (matched by order number) and leaves
orders you created alone.

### Environment variables

| Name             | Required | Description                                                                  |
| ---------------- | -------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL`   | yes      | PostgreSQL connection string. Server-only; never prefix with `NEXT_PUBLIC_`. |
| `DATABASE_URL_UNPOOLED` | prod | Direct (non-pooled) connection for Prisma CLI commands (`migrate`). Falls back to `DATABASE_URL`. |
| `SHOP_TIME_ZONE` | no       | IANA zone (e.g. `Asia/Kuala_Lumpur`) that defines "today". Default `UTC`.    |
| `AUTH_SECRET`    | yes      | ≥ 32 random characters that sign session cookies (`npm run auth:secret`). |
| `EDITOR_USERNAME` / `EDITOR_PASSWORD_HASH` | for editing | Editor account. Store only the scrypt hash from `npm run auth:hash-password`. |
| `DEMO_VIEWER_ENABLED` | no  | `false` hides the read-only demo button. Default enabled.                    |
| `GEMINI_API_KEY` | no       | Enables the AI Operations Brief. Server-only. Without it the brief is rule-based. |
| `GEMINI_MODEL`   | no       | Gemini model name. Default `gemini-flash-latest`.                            |

`.env*` files are gitignored; only `.env.example` is committed. For production
(e.g. Vercel), set these in the host's environment settings and run
`npm run db:deploy` (`prisma migrate deploy`) as part of the release.

## Scripts

| Script              | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm run lint`      | ESLint                                                           |
| `npm run typecheck` | Generates Next.js route types, then `tsc --noEmit`              |
| `npm test`          | Unit tests; database tests skip unless `TEST_DATABASE_URL` set   |
| `npm run test:db`   | Only the PostgreSQL integration tests                            |
| `npm run build`     | `prisma generate` + production build (needs no database)         |
| `npm run db:studio` | Browse data in Prisma Studio                                     |

### Database tests

`src/server/orders/prisma-repository.db.test.ts` runs against a real database
and **deletes every row in `orders`**, so point it at a disposable database:

```bash
docker compose exec postgres psql -U printflow -c "CREATE DATABASE printflow_test;"
export TEST_DATABASE_URL="postgresql://printflow:printflow@localhost:5432/printflow_test?schema=public"
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm run test:db
```

## Architecture

```
prisma/schema.prisma            Order model, enums; migrations/ and seed.ts
prisma7.config.ts               Prisma CLI config (schema, migrations, seed, URL)
src/lib/orders.ts               Domain types, derived workflow status, dates, filters, metrics
src/lib/priority.ts             Urgency rules and plain-language explanations
src/lib/order-validation.ts     zod validation shared by server and form
src/server/orders/service.ts    Use cases: list / create / update / advance, error mapping
src/server/orders/repository.ts Persistence interface; prisma-repository.ts implements it
src/server/orders/actions.ts    Server Actions called by the UI
src/lib/brief/                  Brief input summary, response schema, rule-based fallback
src/server/brief/               Gemini adapter, brief service (fallback, cache), refresh action
src/app/page.tsx                Reads orders at request time inside <Suspense>
src/components/                 UI only — no data access
```

- **Status model.** An order has a lifecycle `status` (active, on hold,
  completed), a production `stage` (artwork → production → quality check →
  ready to ship) and an `artworkApproved` flag. The badge shown in the UI is
  derived from all three. An order can't move past artwork without approval.
- **Rendering.** `cacheComponents` is enabled, so database reads happen after
  `connection()` inside a Suspense boundary. The build never touches the
  database, and mutations call `refresh()` to re-render with fresh data.
- **Errors.** The repository converts Prisma errors into `not_found`,
  `unique_violation` or `unavailable`. The service turns those into
  user-facing results and rethrows anything unexpected. Read failures go to
  `src/app/error.tsx`.
- **Order numbers.** `orders.order_seq` holds the numeric part, allocated from
  the row-locked `order_number_counters` table inside the create transaction,
  so numbering is sequential, numeric past `PF-99999`, and safe under
  concurrency. CHECK constraints (in the migration SQL) enforce quantity
  limits, non-blank text, `order_number = 'PF-' || order_seq` and the
  artwork/completion workflow rules.

## AI Operations Brief

The dashboard's brief is built in three steps:

1. **Facts (deterministic).** `buildBriefInput` computes counts and urgency with
   the existing priority rules and summarises the top 20 open orders: order
   number, cleaned customer name, method, quantity, days to due date, status,
   urgency and the rule-based reason. No product text, database ids or
   anything else is sent.
2. **Gemini (optional).** With `GEMINI_API_KEY` set, the summary goes to Gemini
   with a system instruction that treats order data as untrusted, plus a JSON
   response schema. No tools are configured, so the model can only return
   text, and its output only ever renders as text and order-filter links.
3. **Validation.** The response must parse as JSON, match a strict zod schema
   (no extra fields, bounded lengths) and reference only order numbers present
   in the input. If any check fails, or the key is missing, rate-limited, slow
   (20s timeout) or errors, the brief falls back to rule-based recommendations
   and says why.

Each brief is labelled **AI-generated** or **Rule-based**. AI briefs are cached
for 10 minutes and failed attempts for 1 minute. Refresh forces a new one, at
most every 15 seconds. When orders change after a brief was generated, the
panel shows a notice prompting a refresh. Tests mock Gemini, both at the
service boundary and with a fake `fetch` under the real SDK, so `npm test`
makes no API calls.

## Access control

- **Sign-in page.** Visitors choose **View read-only demo** (a signed viewer
  session, no password) or sign in as the **editor** (username + password).
- **Enforcement is server-side.** Every write server action (create, edit,
  advance) verifies the signed session and requires the editor role before
  calling the order service. The dashboard page checks the session before
  reading data. Hidden buttons in the read-only UI are cosmetic; `src/proxy.ts`
  only redirects signed-out page visits early.
- **Sessions.** Stateless HttpOnly, SameSite=Lax cookie (Secure in production)
  holding role, subject and expiry (8 hours), signed with HMAC-SHA256 using
  `AUTH_SECRET`. Rotating the secret signs everyone out.
- **Passwords.** Only an scrypt hash is stored (colon-separated, so it needs no
  escaping in `.env` files). Failed sign-ins are rate-limited per client and
  username, and wrong usernames take as long to reject as wrong passwords.
- **Fails closed.** No `AUTH_SECRET` means nobody can sign in. No editor
  credentials means nobody can edit.

## Brief latency

Measured with the demo data, the Gemini call took about 20s at the model's
default thinking level, with about 2,400 thinking tokens for a 1,336-token
prompt. That is right at the old 20s deadline, which the SDK also forwards to
Google as `X-Server-Timeout`, so Google returned 504 and the SDK retried for
another 20s. With `thinkingLevel: LOW` the same request took about 5s and still
passed validation. The adapter now uses LOW thinking, a single 30s deadline,
and retries only transient 5xx errors (not 408/429/504). `GEMINI_MODEL` must be
a model that supports thinking levels (Gemini 3 family); otherwise the request
is rejected and the brief falls back to rules.

