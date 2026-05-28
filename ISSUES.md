# Spam Caller Triage System — Free-Tier Implementation TODO

The implementation plan for an open-source spam caller triage system built with:

- Vite
- React
- TypeScript
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Turnstile
- Cloudflare Cron Triggers

The system allows users to report spam caller numbers. Multiple unique reports increase confidence that a number is spam. Users may request removal of a number. If nobody contests the removal request within 7 days, the number is marked as removed.

The plan intentionally avoids paid infrastructure and expensive features.

---

Rules:
  - Keep the project within free-tier-friendly limits.
    - Use Cloudflare Workers only for API requests and server logic.
    - Serve frontend assets as static files through Cloudflare Workers static assets.
    - Use Cloudflare D1 as the only database.
    - Use Cloudflare Turnstile for write-form abuse protection.
    - Use Cloudflare Cron Triggers only once per day.
    - Do not use paid services for MVP.
    - Do not add email sending.
    - Do not add SMS verification.
    - Do not add file uploads.
    - Do not add image evidence uploads.
    - Do not add user accounts.
    - Do not add analytics.
    - Do not add external phone-number lookup APIs.
    - Do not add Queues for MVP.
    - Do not add R2 for MVP.
    - Do not add Durable Objects for MVP.
    - Do not store raw phone numbers in plain text.
    - Do not publicly show full phone numbers.
    - Do not publicly show reporter identity.
    - Do not store long free-form report descriptions for MVP.
    - Store only category-based spam reports.
    - Use deterministic HMAC hashing for number lookup.
    - Use strict database uniqueness rules to prevent duplicate voting.
    - Prefer simple, predictable business logic over complex scoring.

Fixed Technical Decisions:
  - Use Vite as the frontend build tool.
  - Use React as the frontend framework.
  - Use TypeScript for frontend and Worker code.
  - Use Tailwind CSS for styling.
  - Use React Router for frontend routing.
  - Use TanStack Query for API requests and caching.
  - Use React Hook Form for forms.
  - Use Zod for validation.
  - Use libphonenumber-js for phone-number parsing and normalization.
  - Use Cloudflare Workers as the backend runtime.
  - Use Cloudflare Workers static assets for hosting the built Vite app.
  - Use Cloudflare D1 as the only persistent database.
  - Use Cloudflare Turnstile on every public write endpoint.
  - Use Cloudflare Cron Triggers for the daily 7-day removal finalizer.
  - Use an admin password stored as a Cloudflare Worker secret for MVP admin access.
  - Use HMAC-SHA256 for number hashing.
  - Use HMAC-SHA256 for reporter hashing.
  - Use HMAC-SHA256 for IP hashing when needed.
  - Use UTC ISO timestamp strings in the database.
  - Use masked phone numbers in public responses.

Required Cloudflare Services:
  - Use Cloudflare Workers.
    - Host the Worker API.
    - Serve Vite static assets.
    - Store secrets through Worker secrets.
    - Run scheduled cron event once per day.
  - Use Cloudflare D1.
    - Store phone-number report records.
    - Store removal requests.
    - Store removal contests.
    - Store minimal admin-required metadata.
  - Use Cloudflare Turnstile.
    - Protect spam report submissions.
    - Protect removal request submissions.
    - Protect removal contest submissions.
    - Validate Turnstile tokens server-side only.
  - Use Cloudflare Cron Triggers.
    - Run removal finalizer once per day.
    - Do not run cron hourly for MVP.

---

## Required Dependencies

### Runtime Dependencies

- [x] Install frontend/runtime dependencies.
  - [x] Add `@vitejs/plugin-react`.
  - [x] Add `vite`.
  - [x] Add `typescript`.
  - [x] Add `react`.
  - [x] Add `react-dom`.
  - [x] Add `react-router-dom`.
  - [x] Add `@tanstack/react-query`.
  - [x] Add `react-hook-form`.
  - [x] Add `zod`.
  - [x] Add `@hookform/resolvers`.
  - [x] Add `libphonenumber-js`.
  - [x] Add `clsx`.
  - [x] Add `tailwind-merge`.

### Styling Dependencies

- [x] Install Tailwind dependencies.
  - [x] Add `tailwindcss`.
  - [x] Add `postcss`.
  - [x] Add `@tailwindcss/postcss`.

### Cloudflare Dependencies

- [x] Install Cloudflare tooling.
  - [x] Add `wrangler`.
  - [x] Add `@cloudflare/workers-types`.

### Optional Development Dependencies

- [x] Add development quality tools.
  - [x] Add `biomejs`.
  - [x] Add `vitest`.

---

# Phase 1 — Repository and Project Setup

## 1.1 Create the repository structure

- [x] Create the root project directory.
  - [x] Name the project `spam-triage`.
  - [x] Initialize Git.
  - [x] Add a `.gitignore`.
  - [x] Ignore `node_modules`.
  - [x] Ignore `.wrangler`.
  - [x] Ignore `.dev.vars`.
  - [x] Ignore `dist`.
  - [x] Ignore local database files.
  - [x] Add a `README.md`.

- [x] Create the frontend source structure.
  - [x] Create `src/`.
  - [x] Create `src/main.tsx`.
  - [x] Create `src/App.tsx`.
  - [x] Create `src/pages/`.
  - [x] Create `src/components/`.
  - [x] Create `src/lib/`.
  - [x] Create `src/api/`.
  - [x] Create `src/styles/`.

- [x] Create the Worker source structure.
  - [x] Create `worker/`.
  - [x] Create `worker/index.ts`.
  - [x] Create `worker/routes/`.
  - [x] Create `worker/lib/`.
  - [x] Create `worker/jobs/`.

- [x] Create the database migration structure.
  - [x] Create `migrations/`.
  - [x] Create `migrations/0001_initial.sql`.

---

## 1.2 Initialize Vite React TypeScript

- [x] Create a Vite React TypeScript app.
  - [x] Use React.
  - [x] Use TypeScript.
  - [x] Confirm `npm run dev` starts locally.
  - [x] Confirm `npm run build` creates a `dist/` directory.
  - [x] Confirm `npm run preview` serves the built frontend.

- [x] Configure TypeScript.
  - [x] Enable strict mode.
  - [x] Enable JSX React transform.
  - [x] Add path alias support for `@/`.
  - [x] Map `@/` to `src/`.

- [x] Configure Vite.
  - [x] Configure React plugin.
  - [x] Configure path aliases.
  - [x] Ensure production output goes to `dist/`.
  - [x] Keep frontend as a static build.
  - [x] Do not add server-side rendering.

---

## 1.3 Configure Tailwind CSS

- [x] Install Tailwind CSS.
  - [x] Create `postcss.config.js`.
  - [x] Configure Tailwind content paths.
  - [x] Include `index.html`.
  - [x] Include `src/**/*.{ts,tsx}`.

- [x] Create global styles.
  - [x] Create `src/styles/globals.css`.
  - [x] Add Tailwind base layer.
  - [x] Add Tailwind components layer.
  - [x] Add Tailwind utilities layer.
  - [x] Import global styles in `src/main.tsx`.

- [x] Establish simple UI rules.
  - [x] Use a clean layout.
  - [x] Use mobile-first design.
  - [x] Avoid heavy UI libraries.
  - [x] Avoid large icon packs unless tree-shaken.
  - [x] Avoid animation libraries for MVP.

---

## 1.4 Configure Cloudflare Worker

- [x] Create `wrangler.jsonc`.
  - [x] Set Worker name to `spam-triage`.
  - [x] Set Worker entrypoint to `worker/index.ts`.
  - [x] Set compatibility date.
  - [x] Configure static assets directory as `./dist`.
  - [x] Configure assets binding as `ASSETS`.
  - [x] Configure D1 binding as `DB`.
  - [x] Configure cron trigger as daily.
  - [x] Use one daily cron expression: `0 0 * * *`.

- [x] Add Worker types.
  - [x] Create `worker/types.ts`.
  - [x] Define `Env`.
  - [x] Include `DB: D1Database`.
  - [x] Include `ASSETS: Fetcher`.
  - [x] Include `HASH_SECRET: string`.
  - [x] Include `TURNSTILE_SECRET_KEY: string`.
  - [x] Include `ADMIN_PASSWORD: string`.

- [x] Implement Worker entrypoint.
  - [x] Export default object.
  - [x] Implement `fetch(request, env, ctx)`.
  - [x] Implement `scheduled(event, env, ctx)`.
  - [x] Route `/api/*` requests to API handlers.
  - [x] Route non-API requests to static assets.
  - [x] Return 404 for unknown API routes.
  - [x] Return JSON errors for API errors.

---

# Phase 2 — Cloudflare Free-Tier Setup

## 2.1 Create Cloudflare D1 database

- [x] Create the D1 database.
  - [x] Name it `spam-triage-db`.
  - [x] Copy the generated database ID.
  - [x] Add the database ID to `wrangler.jsonc`.
  - [x] Bind it as `DB`.
- [x] Keep D1 usage minimal.
  - [x] Store only required rows.
  - [x] Use indexes only where needed.
  - [x] Do not store large text blobs.
  - [x] Do not store uploaded files.
  - [x] Do not store raw phone numbers.
  - [x] Do not use D1 for analytics events.

---

## 2.2 Configure Worker secrets

- [x] Generate a strong `HASH_SECRET`.
  - [x] Use a long random value.
  - [x] Store it as a Worker secret.
  - [x] Never commit it to Git.
  - [x] Do not expose it to frontend code.

- [x] Configure `TURNSTILE_SECRET_KEY`.
  - [x] Create a Turnstile site in Cloudflare.
  - [x] Store the secret key as a Worker secret.
  - [x] Never validate Turnstile on the frontend only.

- [x] Configure `ADMIN_PASSWORD`.
  - [x] Generate a strong admin password.
  - [x] Store it as a Worker secret.
  - [x] Do not commit it.
  - [x] Use it only for MVP admin access.

- [x] Create `.dev.vars` for local development.
  - [x] Add local `HASH_SECRET`.
  - [x] Add local `TURNSTILE_SECRET_KEY`.
  - [x] Add local `ADMIN_PASSWORD`.
  - [x] Keep `.dev.vars` ignored by Git.

---

## 2.3 Configure Turnstile

- [x] Create a Turnstile widget.
  - [x] Add the production domain.
  - [x] Add the local development domain if supported.
  - [x] Copy the site key.
  - [x] Add the site key to frontend environment config.

- [x] Add frontend environment variable.
  - [x] Create `.env.example`.
  - [x] Add `VITE_TURNSTILE_SITE_KEY=`.
  - [x] Do not include the secret key in frontend env vars.

- [x] Decide protected forms.
  - [x] Protect report submission.
  - [x] Protect removal request submission.
  - [x] Protect removal contest submission.
  - [x] Do not require Turnstile for read-only search.

---

# Phase 3 — Database Schema

## 3.1 Create the `numbers` table

- [x] Add `numbers` table to `migrations/0001_initial.sql`.
  - [x] Add `id INTEGER PRIMARY KEY AUTOINCREMENT`.
  - [x] Add `number_hash TEXT NOT NULL UNIQUE`.
  - [x] Add `display_mask TEXT NOT NULL`.
  - [x] Add `country_code TEXT`.
  - [x] Add `status TEXT NOT NULL DEFAULT 'pending'`.
  - [x] Add `report_count INTEGER NOT NULL DEFAULT 0`.
  - [x] Add `unique_reporter_count INTEGER NOT NULL DEFAULT 0`.
  - [x] Add `removal_request_id INTEGER`.
  - [x] Add `first_reported_at TEXT NOT NULL`.
  - [x] Add `last_reported_at TEXT NOT NULL`.
  - [x] Add `updated_at TEXT NOT NULL`.

- [x] Add indexes for `numbers`.
  - [x] Add unique index on `number_hash`.
  - [x] Add index on `status`.

- [x] Enforce status values in application code.
  - [x] Allow `pending`.
  - [x] Allow `suspected`.
  - [x] Allow `verified_spam`.
  - [x] Allow `under_removal_review`.
  - [x] Allow `removed`.
  - [x] Allow `disputed`.

---

## 3.2 Create the `reports` table

- [x] Add `reports` table.
  - [x] Add `id INTEGER PRIMARY KEY AUTOINCREMENT`.
  - [x] Add `number_id INTEGER NOT NULL`.
  - [x] Add `reporter_hash TEXT NOT NULL`.
  - [x] Add `category TEXT NOT NULL`.
  - [x] Add `created_at TEXT NOT NULL`.
  - [x] Add foreign key to `numbers(id)`.

- [x] Add duplicate prevention.
  - [x] Add `UNIQUE(number_id, reporter_hash)`.
  - [x] Ensure duplicate reports do not increase report count.
  - [x] Return existing status if duplicate report is submitted.

- [x] Add index.
  - [x] Add index on `number_id`.

- [x] Restrict allowed categories.
  - [x] Allow `scam`.
  - [x] Allow `phishing`.
  - [x] Allow `loan_spam`.
  - [x] Allow `robocall`.
  - [x] Allow `impersonation`.
  - [x] Allow `delivery_scam`.
  - [x] Allow `bank_scam`.
  - [x] Allow `unknown`.

---

## 3.3 Create the `removal_requests` table

- [x] Add `removal_requests` table.
  - [x] Add `id INTEGER PRIMARY KEY AUTOINCREMENT`.
  - [x] Add `number_id INTEGER NOT NULL`.
  - [x] Add `requester_hash TEXT NOT NULL`.
  - [x] Add `reason TEXT NOT NULL`.
  - [x] Add `status TEXT NOT NULL DEFAULT 'open'`.
  - [x] Add `contest_deadline TEXT NOT NULL`.
  - [x] Add `created_at TEXT NOT NULL`.
  - [x] Add `updated_at TEXT NOT NULL`.
  - [x] Add foreign key to `numbers(id)`.

- [x] Add indexes.
  - [x] Add index on `(status, contest_deadline)`.
  - [x] Add index on `number_id`.

- [x] Restrict allowed removal reasons.
  - [x] Allow `personal_number`.
  - [x] Allow `incorrect_report`.
  - [x] Allow `recycled_number`.
  - [x] Allow `legitimate_business`.
  - [x] Allow `other`.

- [x] Restrict allowed removal statuses.
  - [x] Allow `open`.
  - [x] Allow `approved`.
  - [x] Allow `contested`.
  - [x] Allow `rejected`.

---

## 3.4 Create the `removal_contests` table

- [x] Add `removal_contests` table.
  - [x] Add `id INTEGER PRIMARY KEY AUTOINCREMENT`.
  - [x] Add `removal_request_id INTEGER NOT NULL`.
  - [x] Add `contestant_hash TEXT NOT NULL`.
  - [x] Add `reason TEXT NOT NULL`.
  - [x] Add `created_at TEXT NOT NULL`.
  - [x] Add foreign key to `removal_requests(id)`.

- [x] Add duplicate prevention.
  - [x] Add `UNIQUE(removal_request_id, contestant_hash)`.
  - [x] Ensure one contestant can only contest once per removal request.

- [x] Add indexes.
  - [x] Add index on `removal_request_id`.

- [x] Restrict allowed contest reasons.
  - [x] Allow `still_spam`.
  - [x] Allow `recent_spam_call`.
  - [x] Allow `known_scam_number`.
  - [x] Allow `other`.

---

## 3.5 Apply migrations

- [ ] Apply migrations locally.
  - [ ] Run D1 local migration.
  - [ ] Confirm all tables are created.
  - [ ] Confirm all indexes are created.

- [ ] Apply migrations remotely.
  - [ ] Run D1 remote migration.
  - [ ] Confirm remote database exists.
  - [ ] Confirm remote schema matches local schema.

---

# Phase 4 — Shared Business Logic

## 4.1 Implement phone-number normalization

- [x] Create `worker/lib/phone.ts`.
  - [x] Import `parsePhoneNumberFromString` from `libphonenumber-js`.
  - [x] Accept input phone number string.
  - [x] Accept country code string.
  - [x] Trim whitespace.
  - [x] Parse with country fallback.
  - [x] Reject invalid numbers.
  - [x] Return E.164 normalized number.
  - [x] Return country code.
  - [x] Return public display mask.

- [x] Implement display masking.
  - [x] Preserve country code when available.
  - [x] Show first useful prefix.
  - [x] Hide middle digits.
  - [x] Show last 4 digits.
  - [x] Example output: `+63 917 *** 4567`.

- [x] Add phone validation tests.
  - [x] Test valid Philippine mobile numbers.
  - [x] Test valid international E.164 numbers.
  - [x] Test invalid short numbers.
  - [x] Test letters in phone input.
  - [x] Test empty input.

---

## 4.2 Implement HMAC hashing

- [x] Create `worker/lib/hash.ts`.
  - [x] Implement `hmacSha256(secret, value)`.
  - [x] Use Web Crypto API.
  - [x] Return lowercase hex string.
  - [x] Do not use plain SHA-256.

- [x] Implement number hashing.
  - [x] Normalize number first.
  - [x] HMAC normalized number with `HASH_SECRET`.
  - [x] Store result as `number_hash`.

- [x] Implement reporter hashing.
  - [x] Create stable reporter key from available request data.
  - [x] Use Turnstile result plus IP hash where available.
  - [x] Avoid storing raw IP.
  - [x] HMAC reporter key with `HASH_SECRET`.
  - [x] Store only `reporter_hash`.

- [x] Implement requester hashing.
  - [x] Use same approach as reporter hashing.
  - [x] Store only `requester_hash`.

- [x] Implement contestant hashing.
  - [x] Use same approach as reporter hashing.
  - [x] Store only `contestant_hash`.

---

## 4.3 Implement status scoring

- [x] Create `worker/lib/scoring.ts`.
  - [x] Export `computeNumberStatus`.
  - [x] Accept unique reporter count.
  - [x] Accept existing number status.
  - [x] Preserve `removed` status unless a new valid report reopens review.
  - [x] Preserve `under_removal_review` while removal request is open.
  - [x] Preserve `disputed` until admin resolves.

- [x] Implement MVP scoring rules.
  - [x] Return `pending` for 1 unique report.
  - [x] Return `suspected` for 2 unique reports.
  - [x] Return `verified_spam` for 3 or more unique reports.
  - [x] Return `under_removal_review` when an open removal request exists.
  - [x] Return `disputed` when a removal contest exists.
  - [x] Return `removed` when removal is approved.

- [x] Do not implement ML scoring.
- [x] Do not implement weighted reputation.
- [x] Do not implement paid external checks.

---

## 4.4 Implement JSON response helpers

- [x] Create `worker/lib/http.ts`.
  - [x] Implement `json(data, status)`.
  - [x] Implement `jsonError(message, status, code)`.
  - [x] Set `content-type` to `application/json`.
  - [x] Avoid leaking stack traces.
  - [x] Return stable error codes.

- [x] Standardize success responses.
  - [x] Include `ok: true`.
  - [x] Include relevant data.
  - [x] Do not return internal IDs unless needed by frontend.
  - [x] Do not return number hash unless required for public route.

- [x] Standardize error responses.
  - [x] Include `ok: false`.
  - [x] Include `error.code`.
  - [x] Include `error.message`.
  - [x] Do not expose secrets.
  - [x] Do not expose raw SQL errors.

---

## 4.5 Implement Turnstile verification

- [x] Create `worker/lib/turnstile.ts`.
  - [x] Accept token.
  - [x] Accept remote IP when available.
  - [x] POST to Turnstile verification endpoint.
  - [x] Use `TURNSTILE_SECRET_KEY`.
  - [x] Return success or failure.
  - [x] Reject missing tokens.
  - [x] Reject invalid tokens.
  - [x] Reject expired tokens.

- [x] Use Turnstile on write endpoints.
  - [x] Validate before report insertion.
  - [x] Validate before removal request creation.
  - [x] Validate before removal contest creation.

- [x] Do not use Turnstile on read-only endpoints.
  - [x] Do not require it for checking a number.
  - [x] Do not require it for viewing a removal request.

---

# Phase 5 — Worker API

## 5.1 Implement API router

- [x] Implement path routing in `worker/index.ts`.
  - [x] Route `GET /api/health`.
  - [x] Route `POST /api/reports`.
  - [x] Route `GET /api/numbers/check`.
  - [x] Route `POST /api/removal-requests`.
  - [x] Route `GET /api/removal-requests/:id`.
  - [x] Route `POST /api/removal-requests/:id/contest`.
  - [x] Route `GET /api/admin/summary`.
  - [x] Route `GET /api/admin/removal-requests`.
  - [x] Route `POST /api/admin/removal-requests/:id/resolve`.

- [x] Enforce HTTP methods.
  - [x] Return 405 for unsupported methods.
  - [x] Return 404 for unknown routes.
  - [x] Return JSON for API errors.

---

## 5.2 Implement health endpoint

- [x] Implement `GET /api/health`.
  - [x] Return `ok: true`.
  - [x] Return app name.
  - [x] Return environment if safe.
  - [x] Do not query D1.
  - [x] Do not expose secrets.

---

## 5.3 Implement report endpoint

- [x] Implement `POST /api/reports`.
  - [x] Parse JSON body.
  - [x] Validate body with Zod.
  - [x] Require `phoneNumber`.
  - [x] Require `country`.
  - [x] Require `category`.
  - [x] Require `turnstileToken`.
  - [x] Reject unknown categories.
  - [x] Reject invalid phone numbers.
  - [x] Validate Turnstile token.
  - [x] Normalize phone number.
  - [x] HMAC hash normalized number.
  - [x] Generate display mask.
  - [x] Generate reporter hash.
  - [x] Look up number by `number_hash`.
  - [x] Create number row if missing.
  - [x] Insert report with `UNIQUE(number_id, reporter_hash)`.
  - [x] Do not increase count if duplicate.
  - [x] Recalculate report count.
  - [x] Recalculate unique reporter count.
  - [x] Recompute number status.
  - [x] Update number row.
  - [x] Return masked number.
  - [x] Return status.
  - [x] Return report count.
  - [x] Return duplicate flag when applicable.

- [x] Keep report payload small.
  - [x] Do not accept report descriptions for MVP.
  - [x] Do not accept evidence uploads.
  - [x] Do not accept attachments.
  - [x] Do not accept user identity fields.

---

## 5.4 Implement number check endpoint

- [x] Implement `GET /api/numbers/check`.
  - [x] Read `number` query parameter.
  - [x] Read optional `country` query parameter.
  - [x] Reject missing number.
  - [x] Normalize number.
  - [x] Hash normalized number.
  - [x] Look up number by `number_hash`.
  - [x] Return `found: false` if missing.
  - [x] Return masked number if found.
  - [x] Return status if found.
  - [x] Return report count if found.
  - [x] Return unique reporter count if found.
  - [x] Return removal status if under removal review.
  - [x] Do not return internal number ID.
  - [x] Do not return reporter hashes.
  - [x] Do not return raw phone number.

- [x] Keep search cheap.
  - [x] Use indexed `number_hash` lookup.
  - [x] Do not perform fuzzy search.
  - [x] Do not allow listing all numbers.
  - [x] Do not expose autocomplete for MVP.

---

## 5.5 Implement removal request creation

- [x] Implement `POST /api/removal-requests`.
  - [x] Parse JSON body.
  - [x] Validate body with Zod.
  - [x] Require `phoneNumber`.
  - [x] Require `country`.
  - [x] Require `reason`.
  - [x] Require `turnstileToken`.
  - [x] Reject unknown removal reasons.
  - [x] Validate Turnstile token.
  - [x] Normalize phone number.
  - [x] Hash normalized number.
  - [x] Look up existing number.
  - [x] Create a number row if it does not exist.
  - [x] Prevent multiple open removal requests for the same number.
  - [x] Create removal request with `contest_deadline = now + 7 days`.
  - [x] Set removal request status to `open`.
  - [x] Update number status to `under_removal_review`.
  - [x] Store removal request ID on number row.
  - [x] Return removal request ID.
  - [x] Return contest deadline.
  - [x] Return masked number.

- [x] Keep removal requests simple.
  - [x] Do not request proof documents.
  - [x] Do not allow file uploads.
  - [x] Do not collect email address for MVP.
  - [x] Do not notify users by email.

---

## 5.6 Implement removal request details

- [x] Implement `GET /api/removal-requests/:id`.
  - [x] Validate ID is numeric.
  - [x] Look up removal request.
  - [x] Join related number row.
  - [x] Count contests.
  - [x] Return masked number.
  - [x] Return removal reason.
  - [x] Return removal status.
  - [x] Return contest deadline.
  - [x] Return contest count.
  - [x] Return whether contest window is still open.
  - [x] Do not return requester hash.
  - [x] Do not return contestant hashes.

---

## 5.7 Implement removal contest endpoint

- [x] Implement `POST /api/removal-requests/:id/contest`.
  - [x] Validate ID is numeric.
  - [x] Parse JSON body.
  - [x] Validate body with Zod.
  - [x] Require `reason`.
  - [x] Require `turnstileToken`.
  - [x] Reject unknown contest reasons.
  - [x] Validate Turnstile token.
  - [x] Look up removal request.
  - [x] Reject missing removal request.
  - [x] Reject non-open removal request.
  - [x] Reject contest after deadline.
  - [x] Generate contestant hash.
  - [x] Insert contest with uniqueness rule.
  - [x] Do not duplicate contest from same contestant.
  - [x] Set number status to `disputed`.
  - [x] Return contest count.
  - [x] Return number status.

- [x] Keep contest simple.
  - [x] Do not accept attachments.
  - [x] Do not accept long descriptions.
  - [x] Do not show public comments.

---

# Phase 6 — Scheduled 7-Day Finalizer

## 6.1 Implement scheduled Worker handler

- [x] Add `scheduled(event, env, ctx)` in Worker entrypoint.
  - [x] Call `finalizeRemovalRequests(env)`.
  - [x] Catch errors.
  - [x] Do not throw unhandled exceptions.
  - [x] Keep work bounded.
  - [x] Process a limited batch per run.
  - [x] Use daily cron only.

---

## 6.2 Implement finalizer job

- [x] Create `worker/jobs/finalize-removals.ts`.
  - [x] Query open removal requests where `contest_deadline <= now`.
  - [x] Limit batch size to 100.
  - [x] For each open removal request, count contests.
  - [x] If contest count is 0, approve removal.
  - [x] If contest count is greater than 0, mark as contested.
  - [x] Update related number status.
  - [x] Save updated timestamps.

- [x] Implement no-contest approval.
  - [x] Set `removal_requests.status = 'approved'`.
  - [x] Set `numbers.status = 'removed'`.
  - [x] Keep report rows for historical deduplication.
  - [x] Do not publicly expose removed numbers as active spam.

- [x] Implement contested handling.
  - [x] Set `removal_requests.status = 'contested'`.
  - [x] Set `numbers.status = 'disputed'`.
  - [x] Require admin review later.

- [x] Keep cron free-tier friendly.
  - [x] Run once per day.
  - [x] Do not scan the entire database.
  - [x] Use index on `(status, contest_deadline)`.
  - [x] Limit batch size.
  - [x] Do not generate emails.
  - [x] Do not call external APIs.

---

# Phase 7 — Frontend Foundation

## 7.1 Create app shell

- [x] Implement base layout.
  - [x] Add header.
  - [x] Add navigation links.
  - [x] Add main content area.
  - [x] Add footer.
  - [x] Add privacy-first message in footer.

- [x] Create navigation routes.
  - [x] Route `/` to homepage.
  - [x] Route `/check` to number checker page.
  - [x] Route `/report` to report page.
  - [x] Route `/remove` to removal request page.
  - [x] Route `/removal/:id` to removal request detail page.
  - [x] Route `/admin` to basic admin page.
  - [x] Route unknown paths to not-found page.

- [x] Keep bundle small.
  - [x] Do not add heavy component frameworks.
  - [x] Do not add chart libraries for MVP.
  - [x] Do not add animation libraries for MVP.
  - [x] Do not add map libraries.

---

## 7.2 Implement API client

- [x] Create `src/api/client.ts`.
  - [x] Implement `apiGet`.
  - [x] Implement `apiPost`.
  - [x] Parse JSON responses.
  - [x] Handle non-2xx responses.
  - [x] Convert API error response into frontend error object.
  - [x] Do not hardcode production domain.
  - [x] Use relative `/api` URLs.

- [x] Create API functions.
  - [x] Create `checkNumber`.
  - [x] Create `submitReport`.
  - [x] Create `createRemovalRequest`.
  - [x] Create `getRemovalRequest`.
  - [x] Create `contestRemovalRequest`.
  - [x] Create `getAdminSummary`.
  - [x] Create `getAdminRemovalRequests`.
  - [x] Create `resolveAdminRemovalRequest`.

---

## 7.3 Create shared UI components

- [x] Create `Button` component.
  - [x] Support primary variant.
  - [x] Support secondary variant.
  - [x] Support disabled state.
  - [x] Support loading state.

- [x] Create `Input` component.
  - [x] Support label.
  - [x] Support error message.
  - [x] Support helper text.

- [x] Create `Select` component.
  - [x] Support label.
  - [x] Support options.
  - [x] Support error message.

- [x] Create `Card` component.
  - [x] Use for result displays.
  - [x] Use for forms.
  - [x] Use for status summaries.

- [x] Create `StatusBadge` component.
  - [x] Render `pending`.
  - [x] Render `suspected`.
  - [x] Render `verified_spam`.
  - [x] Render `under_removal_review`.
  - [x] Render `removed`.
  - [x] Render `disputed`.

- [x] Create `TurnstileWidget` component.
  - [x] Load Turnstile script.
  - [x] Render widget using `VITE_TURNSTILE_SITE_KEY`.
  - [x] Emit token to form state.
  - [x] Reset token after submission.

---

# Phase 8 — Frontend Pages

## 8.1 Homepage

- [x] Implement homepage.
  - [x] Explain that the system is community-based.
  - [x] Explain that multiple unique reports increase spam confidence.
  - [x] Explain that removal requests have a 7-day contest period.
  - [x] Explain that the system stores hashes and masked numbers.
  - [x] Add call-to-action to check a number.
  - [x] Add call-to-action to report a number.
  - [x] Add call-to-action to request removal.

- [x] Add free-tier/open-source transparency.
  - [x] State that the project avoids accounts, uploads, and tracking for MVP.
  - [x] State that data collection is intentionally minimal.
  - [x] State that abuse protection uses Turnstile.

---

## 8.2 Check number page

- [x] Implement `/check`.
  - [x] Add phone-number input.
  - [x] Add country selector.
  - [x] Default country to `PH`.
  - [x] Add submit button.
  - [x] Call `GET /api/numbers/check`.
  - [x] Display loading state.
  - [x] Display errors.
  - [x] Display result.

- [x] Implement result states.
  - [x] Show `No reports found` when `found` is false.
  - [x] Show masked number when found.
  - [x] Show status badge.
  - [x] Show report count.
  - [x] Show unique reporter count.
  - [x] Show removal deadline if under removal review.
  - [x] Show link to report again.
  - [x] Show link to request removal.

- [x] Keep read endpoint free-tier friendly.
  - [x] Do not auto-query while typing.
  - [x] Query only when the user submits.
  - [x] Do not add autocomplete.
  - [x] Do not list recent numbers.

---

## 8.3 Report page

- [x] Implement `/report`.
  - [x] Add phone-number input.
  - [x] Add country selector.
  - [x] Default country to `PH`.
  - [x] Add spam category select.
  - [x] Add Turnstile widget.
  - [x] Add submit button.
  - [x] Validate form with Zod.
  - [x] Call `POST /api/reports`.
  - [x] Reset Turnstile after submission.
  - [x] Display success result.
  - [x] Display duplicate report message when duplicate.
  - [x] Display current number status.

- [x] Implement category options.
  - [x] Scam.
  - [x] Phishing.
  - [x] Loan spam.
  - [x] Robocall.
  - [x] Impersonation.
  - [x] Delivery scam.
  - [x] Bank scam.
  - [x] Unknown.

- [x] Keep form abuse-resistant.
  - [x] Require Turnstile.
  - [x] Do not allow descriptions.
  - [x] Do not allow attachments.
  - [x] Do not allow batch reporting.
  - [x] Do not submit automatically.

---

## 8.4 Removal request page

- [x] Implement `/remove`.
  - [x] Add phone-number input.
  - [x] Add country selector.
  - [x] Default country to `PH`.
  - [x] Add removal reason select.
  - [x] Add Turnstile widget.
  - [x] Add submit button.
  - [x] Validate form with Zod.
  - [x] Call `POST /api/removal-requests`.
  - [x] Display removal request ID.
  - [x] Display masked number.
  - [x] Display contest deadline.
  - [x] Link to `/removal/:id`.

- [x] Implement removal reasons.
  - [x] Personal number.
  - [x] Incorrect report.
  - [x] Recycled number.
  - [x] Legitimate business.
  - [x] Other.

- [x] Explain rules on the page.
  - [x] Explain that removal is not immediate.
  - [x] Explain that the contest period lasts 7 days.
  - [x] Explain that no contest means the number will be removed.
  - [x] Explain that a contest means the number becomes disputed.

---

## 8.5 Removal detail and contest page

- [x] Implement `/removal/:id`.
  - [x] Fetch removal request details.
  - [x] Display masked number.
  - [x] Display removal status.
  - [x] Display removal reason.
  - [x] Display contest deadline.
  - [x] Display contest count.
  - [x] Display whether the contest window is open.
  - [x] Show contest form only when status is `open` and deadline has not passed.

- [x] Implement contest form.
  - [x] Add contest reason select.
  - [x] Add Turnstile widget.
  - [x] Add submit button.
  - [x] Validate with Zod.
  - [x] Call `POST /api/removal-requests/:id/contest`.
  - [x] Show success message.
  - [x] Refresh removal request details.

- [x] Implement contest reasons.
  - [x] Still spam.
  - [x] Recent spam call.
  - [x] Known scam number.
  - [x] Other.

---

# Phase 9 — Basic Admin MVP

## 9.1 Implement admin authentication

- [x] Use password-only admin access for MVP.
  - [x] Add password input on `/admin`.
  - [x] Send password as `Authorization: Bearer <password>`.
  - [x] Compare against `ADMIN_PASSWORD` in Worker.
  - [x] Do not store admin password in localStorage.
  - [x] Keep password only in memory state during session.
  - [x] Clear password when tab reloads.

- [x] Protect admin API routes.
  - [x] Require `Authorization` header.
  - [x] Reject missing token.
  - [x] Reject incorrect token.
  - [x] Return 401 JSON error.

---

## 9.2 Implement admin summary endpoint

- [x] Implement `GET /api/admin/summary`.
  - [x] Count total numbers.
  - [x] Count pending numbers.
  - [x] Count suspected numbers.
  - [x] Count verified spam numbers.
  - [x] Count under-removal-review numbers.
  - [x] Count disputed numbers.
  - [x] Count removed numbers.
  - [x] Count open removal requests.
  - [x] Count contested removal requests.
  - [x] Keep queries simple.
  - [x] Do not compute expensive analytics.

---

## 9.3 Implement admin removal review endpoint

- [x] Implement `GET /api/admin/removal-requests`.
  - [x] Return open and contested removal requests.
  - [x] Limit results to 100.
  - [x] Include masked number.
  - [x] Include status.
  - [x] Include reason.
  - [x] Include contest count.
  - [x] Include contest deadline.
  - [x] Sort by newest first.

- [x] Implement frontend admin list.
  - [x] Show removal request rows.
  - [x] Show masked number.
  - [x] Show status.
  - [x] Show reason.
  - [x] Show contest count.
  - [x] Show deadline.
  - [x] Add approve button.
  - [x] Add reject button.
  - [x] Add mark disputed button.

---

## 9.4 Implement admin resolution endpoint

- [x] Implement `POST /api/admin/removal-requests/:id/resolve`.
  - [x] Require admin auth.
  - [x] Validate request ID.
  - [x] Validate action.
  - [x] Allow action `approve_removal`.
  - [x] Allow action `reject_removal`.
  - [x] Allow action `mark_disputed`.

- [x] Implement approve removal.
  - [x] Set removal request status to `approved`.
  - [x] Set number status to `removed`.

- [x] Implement reject removal.
  - [x] Set removal request status to `rejected`.
  - [x] Recompute number status from unique report count.

- [x] Implement mark disputed.
  - [x] Set removal request status to `contested`.
  - [x] Set number status to `disputed`.

- [x] Keep admin minimal.
  - [x] Do not add role management.
  - [x] Do not add user accounts.
  - [x] Do not add activity timeline for MVP.

---

# Phase 10 — Privacy and Security

## 10.1 Enforce privacy constraints

- [x] Never store plain raw phone numbers.
  - [x] Normalize phone number in memory only.
  - [x] Generate HMAC hash.
  - [x] Store HMAC hash.
  - [x] Generate display mask.
  - [x] Store display mask.
  - [x] Discard raw normalized number.

- [x] Never expose sensitive fields in API.
  - [x] Do not return `number_hash`.
  - [x] Do not return `reporter_hash`.
  - [x] Do not return `requester_hash`.
  - [x] Do not return `contestant_hash`.
  - [x] Do not return IP-derived values.
  - [x] Do not return database internals unless necessary.

- [x] Use minimal data collection.
  - [x] Store report category.
  - [x] Store removal reason.
  - [x] Store contest reason.
  - [x] Store timestamps.
  - [x] Do not store names.
  - [x] Do not store emails.
  - [x] Do not store accounts.
  - [x] Do not store free-form evidence text for MVP.

---

## 10.2 Add input validation

- [x] Validate all request bodies with Zod.
  - [x] Validate report body.
  - [x] Validate removal request body.
  - [x] Validate contest body.
  - [x] Validate admin resolve body.

- [x] Validate query parameters.
  - [x] Validate phone number query parameter.
  - [x] Validate country query parameter.
  - [x] Validate numeric IDs.

- [x] Reject large payloads.
  - [x] Limit JSON body size in Worker logic.
  - [x] Reject bodies over 10 KB.
  - [x] Do not accept arrays for report submissions.
  - [x] Do not accept nested arbitrary objects.

---

## 10.3 Add basic abuse limits

- [x] Use Turnstile on writes.
  - [x] Report endpoint.
  - [x] Removal request endpoint.
  - [x] Removal contest endpoint.

- [x] Use database uniqueness as anti-spam.
  - [x] One report per number per reporter hash.
  - [x] One contest per removal request per contestant hash.
  - [x] One open removal request per number.

---

# Phase 11 — Free-Tier Cost Controls

## 11.1 Worker request controls

- [x] Avoid unnecessary API requests.
  - [x] Do not auto-search while user types.
  - [x] Do not poll removal request pages.
  - [x] Do not refresh admin dashboard automatically.
  - [x] Do not send analytics events.
  - [x] Do not perform background client requests.

- [x] Keep API responses small.
  - [x] Return only required fields.
  - [x] Do not return lists of public numbers.
  - [x] Do not expose raw database rows.
  - [x] Do not include large descriptions.

- [x] Cache static assets.
  - [x] Let Cloudflare cache built frontend assets.
  - [x] Use hashed Vite asset filenames.
  - [x] Avoid dynamic rendering for normal pages.

---

## 11.2 D1 usage controls

- [x] Use indexed lookups.
  - [x] Search numbers by `number_hash`.
  - [x] Query removal jobs by `status` and `contest_deadline`.
  - [x] Query reports by `number_id`.

- [x] Avoid expensive database features.
  - [x] Do not use full-text search.
  - [x] Do not use fuzzy search.
  - [x] Do not use analytics aggregation on every page load.
  - [x] Do not list all reports publicly.
  - [x] Do not store logs for every request.

- [x] Keep tables small.
  - [x] Do not store uploaded files.
  - [x] Do not store comments.
  - [x] Do not store long descriptions.
  - [x] Do not store raw phone numbers.

---

## 11.3 Cron controls

- [x] Run cron once daily only.
  - [x] Use `0 0 * * *`.
  - [x] Process only due open removal requests.
  - [x] Limit processing to 100 rows per run.
  - [x] Do not scan all reports.
  - [x] Do not call external APIs.
  - [x] Do not send notifications.

---

## 11.4 Launch traffic controls

- [x] Add simple public messaging.
  - [x] Explain this is a community project.
  - [x] Explain reports are rate-limited by abuse protection.
  - [x] Explain data is minimal.

- [x] Prepare abuse fallback.
  - [x] Be ready to temporarily disable report submissions.
  - [x] Be ready to temporarily disable removal contests.
  - [x] Be ready to add stricter Turnstile settings.
  - [x] Be ready to add Cloudflare firewall rules.

---

# Phase 12 — Testing

## 12.1 Unit tests

- [x] Test phone normalization.
  - [x] Valid PH number.
  - [x] Valid E.164 number.
  - [x] Invalid number.
  - [x] Empty string.
  - [x] Number with spaces and dashes.

- [x] Test masking.
  - [x] Mask PH mobile number.
  - [x] Mask international number.
  - [x] Never expose full number.

- [x] Test scoring.
  - [x] 1 report returns `pending`.
  - [x] 2 reports return `suspected`.
  - [x] 3 reports return `verified_spam`.
  - [x] Open removal returns `under_removal_review`.
  - [x] Contest returns `disputed`.
  - [x] Approved removal returns `removed`.

- [x] Test validation schemas.
  - [x] Valid report body.
  - [x] Invalid category.
  - [x] Missing Turnstile token.
  - [x] Invalid removal reason.
  - [x] Invalid contest reason.

---

## 12.2 API integration tests

- [x] Test report submission.
  - [x] Submit first report.
  - [x] Confirm status is `pending`.
  - [x] Submit duplicate report.
  - [x] Confirm count does not increase.
  - [x] Submit reports from different reporter hashes.
  - [x] Confirm status changes to `suspected`.
  - [x] Confirm status changes to `verified_spam`.

- [x] Test number check.
  - [x] Check missing number.
  - [x] Confirm `found: false`.
  - [x] Check reported number.
  - [x] Confirm masked number is returned.
  - [x] Confirm raw number is not returned.

- [x] Test removal request.
  - [x] Create removal request.
  - [x] Confirm 7-day deadline.
  - [x] Confirm number status becomes `under_removal_review`.
  - [x] Prevent duplicate open removal request.

- [x] Test contest flow.
  - [x] Contest open removal request.
  - [x] Confirm contest count increases.
  - [x] Confirm number becomes `disputed`.
  - [x] Prevent duplicate contest.

- [x] Test finalizer.
  - [x] Finalize open request with no contests.
  - [x] Confirm number becomes `removed`.
  - [x] Finalize open request with contests.
  - [x] Confirm number becomes `disputed`.

---

# Phase 13 — Documentation

## 13.1 README

- [ ] Create project README.
  - [ ] Explain project purpose.
  - [ ] Explain free-tier-first architecture.
  - [ ] Explain privacy model.
  - [ ] Explain database choices.
  - [ ] Explain removal contest process.
  - [ ] Explain local development setup.
  - [ ] Explain deployment setup.
  - [ ] Explain Cloudflare services required.
  - [ ] Explain what is intentionally not included.

---

## 13.2 Environment documentation

- [ ] Create `.env.example`.
  - [ ] Add `VITE_TURNSTILE_SITE_KEY=`.
  - [ ] Do not include Worker secrets.

- [ ] Create `.dev.vars.example`.
  - [ ] Add `HASH_SECRET=`.
  - [ ] Add `TURNSTILE_SECRET_KEY=`.
  - [ ] Add `ADMIN_PASSWORD=`.
  - [ ] Mark as local-only.
  - [ ] Tell users to copy to `.dev.vars`.

---

## 13.3 Privacy policy

- [ ] Create `docs/privacy.md`.
  - [ ] State no accounts are required.
  - [ ] State no analytics are used.
  - [ ] State no ads are used.
  - [ ] State no tracking is used.
  - [ ] State reports are stored as hashed phone-number records.
  - [ ] State phone numbers are publicly masked.
  - [ ] State raw phone numbers are not stored in plain text.
  - [ ] State Turnstile is used for abuse prevention.
  - [ ] State removal requests are available.

---

## 13.4 Contributing guide

- [ ] Create `CONTRIBUTING.md`.
  - [ ] Explain how to run locally.
  - [ ] Explain how to run migrations.
  - [ ] Explain how to test.
  - [ ] Explain free-tier constraints.
  - [ ] Require issues before adding paid-service dependencies.
  - [ ] Require privacy review before adding new stored fields.
  - [ ] Require abuse review before adding public endpoints.

---

# Phase 14 — Deployment

## 14.1 Local deployment check

- [ ] Run frontend build.
  - [ ] Run `npm run build`.
  - [ ] Confirm `dist/` exists.
  - [ ] Confirm app loads locally.

- [ ] Run Worker locally.
  - [ ] Run Wrangler dev.
  - [ ] Confirm static frontend is served.
  - [ ] Confirm `/api/health` works.
  - [ ] Confirm D1 local binding works.
  - [ ] Confirm Turnstile local behavior is handled.

---

## 14.2 Remote deployment

- [ ] Deploy D1 migrations remotely.
  - [ ] Apply initial migration.
  - [ ] Confirm remote schema.

- [ ] Set Worker secrets remotely.
  - [ ] Set `HASH_SECRET`.
  - [ ] Set `TURNSTILE_SECRET_KEY`.
  - [ ] Set `ADMIN_PASSWORD`.

- [ ] Deploy Worker.
  - [ ] Run deploy command.
  - [ ] Confirm frontend loads.
  - [ ] Confirm `/api/health` works.
  - [ ] Confirm report form works.
  - [ ] Confirm check form works.
  - [ ] Confirm removal request works.
  - [ ] Confirm contest page works.
  - [ ] Confirm admin page works.

---

## 14.3 Post-deploy free-tier review

- [ ] Review Worker usage.
  - [ ] Confirm no unexpected API polling.
  - [ ] Confirm static assets are served correctly.
  - [ ] Confirm API calls only happen on user actions.

- [ ] Review D1 usage.
  - [ ] Confirm reports create minimal rows.
  - [ ] Confirm no large data is stored.
  - [ ] Confirm no analytics table is being written.

- [ ] Review Turnstile.
  - [ ] Confirm write endpoints reject missing token.
  - [ ] Confirm write endpoints accept valid token.
  - [ ] Confirm read endpoints do not require Turnstile.

---

# Phase 15 — MVP Launch Checklist

- [ ] Confirm the system works without paid Cloudflare services.
- [ ] Confirm no raw phone numbers are stored in plain text.
- [ ] Confirm public results only show masked numbers.
- [ ] Confirm one reporter cannot verify a number alone.
- [ ] Confirm duplicate reports do not increase count.
- [ ] Confirm 3 unique reports marks a number as verified spam.
- [ ] Confirm removal request creates a 7-day contest period.
- [ ] Confirm no-contest removal marks the number as removed.
- [ ] Confirm contested removal marks the number as disputed.
- [ ] Confirm admin can approve removal.
- [ ] Confirm admin can reject removal.
- [ ] Confirm admin can mark as disputed.
- [ ] Confirm no uploads exist.
- [ ] Confirm no account system exists.
- [ ] Confirm no analytics exists.
- [ ] Confirm no external paid APIs are used.
- [ ] Confirm README explains free-tier constraints.
- [ ] Confirm privacy policy exists.
- [ ] Confirm `.env.example` exists.
- [ ] Confirm `.dev.vars.example` exists.
- [ ] Tag the first MVP release.

---
