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

- [ ] Install frontend/runtime dependencies.
  - [ ] Add `@vitejs/plugin-react`.
  - [ ] Add `vite`.
  - [ ] Add `typescript`.
  - [ ] Add `react`.
  - [ ] Add `react-dom`.
  - [ ] Add `react-router-dom`.
  - [ ] Add `@tanstack/react-query`.
  - [ ] Add `react-hook-form`.
  - [ ] Add `zod`.
  - [ ] Add `@hookform/resolvers`.
  - [ ] Add `libphonenumber-js`.
  - [ ] Add `clsx`.
  - [ ] Add `tailwind-merge`.

### Styling Dependencies

- [ ] Install Tailwind dependencies.
  - [ ] Add `tailwindcss`.
  - [ ] Add `postcss`.
  - [ ] Add `autoprefixer`.

### Cloudflare Dependencies

- [ ] Install Cloudflare tooling.
  - [ ] Add `wrangler`.
  - [ ] Add `@cloudflare/workers-types`.

### Optional Development Dependencies

- [ ] Add development quality tools.
  - [x] Add `biomejs`.
  - [ ] Add `vitest`.

---

# Phase 1 — Repository and Project Setup

## 1.1 Create the repository structure

- [ ] Create the root project directory.
  - [ ] Name the project `spam-triage`.
  - [ ] Initialize Git.
  - [ ] Add a `.gitignore`.
  - [ ] Ignore `node_modules`.
  - [ ] Ignore `.wrangler`.
  - [ ] Ignore `.dev.vars`.
  - [ ] Ignore `dist`.
  - [ ] Ignore local database files.
  - [ ] Add a `README.md`.

- [ ] Create the frontend source structure.
  - [ ] Create `src/`.
  - [ ] Create `src/main.tsx`.
  - [ ] Create `src/App.tsx`.
  - [ ] Create `src/pages/`.
  - [ ] Create `src/components/`.
  - [ ] Create `src/lib/`.
  - [ ] Create `src/api/`.
  - [ ] Create `src/styles/`.

- [ ] Create the Worker source structure.
  - [ ] Create `worker/`.
  - [ ] Create `worker/index.ts`.
  - [ ] Create `worker/routes/`.
  - [ ] Create `worker/lib/`.
  - [ ] Create `worker/jobs/`.

- [ ] Create the database migration structure.
  - [ ] Create `migrations/`.
  - [ ] Create `migrations/0001_initial.sql`.

---

## 1.2 Initialize Vite React TypeScript

- [ ] Create a Vite React TypeScript app.
  - [ ] Use React.
  - [ ] Use TypeScript.
  - [ ] Confirm `npm run dev` starts locally.
  - [ ] Confirm `npm run build` creates a `dist/` directory.
  - [ ] Confirm `npm run preview` serves the built frontend.

- [ ] Configure TypeScript.
  - [ ] Enable strict mode.
  - [ ] Enable JSX React transform.
  - [ ] Add path alias support for `@/`.
  - [ ] Map `@/` to `src/`.

- [ ] Configure Vite.
  - [ ] Configure React plugin.
  - [ ] Configure path aliases.
  - [ ] Ensure production output goes to `dist/`.
  - [ ] Keep frontend as a static build.
  - [ ] Do not add server-side rendering.

---

## 1.3 Configure Tailwind CSS

- [ ] Install Tailwind CSS.
  - [ ] Create `tailwind.config.js`.
  - [ ] Create `postcss.config.js`.
  - [ ] Configure Tailwind content paths.
  - [ ] Include `index.html`.
  - [ ] Include `src/**/*.{ts,tsx}`.

- [ ] Create global styles.
  - [ ] Create `src/styles/globals.css`.
  - [ ] Add Tailwind base layer.
  - [ ] Add Tailwind components layer.
  - [ ] Add Tailwind utilities layer.
  - [ ] Import global styles in `src/main.tsx`.

- [ ] Establish simple UI rules.
  - [ ] Use a clean layout.
  - [ ] Use mobile-first design.
  - [ ] Avoid heavy UI libraries.
  - [ ] Avoid large icon packs unless tree-shaken.
  - [ ] Avoid animation libraries for MVP.

---

## 1.4 Configure Cloudflare Worker

- [ ] Create `wrangler.jsonc`.
  - [ ] Set Worker name to `spam-triage`.
  - [ ] Set Worker entrypoint to `worker/index.ts`.
  - [ ] Set compatibility date.
  - [ ] Configure static assets directory as `./dist`.
  - [ ] Configure assets binding as `ASSETS`.
  - [ ] Configure D1 binding as `DB`.
  - [ ] Configure cron trigger as daily.
  - [ ] Use one daily cron expression: `0 0 * * *`.

- [ ] Add Worker types.
  - [ ] Create `worker/types.ts`.
  - [ ] Define `Env`.
  - [ ] Include `DB: D1Database`.
  - [ ] Include `ASSETS: Fetcher`.
  - [ ] Include `HASH_SECRET: string`.
  - [ ] Include `TURNSTILE_SECRET_KEY: string`.
  - [ ] Include `ADMIN_PASSWORD: string`.

- [ ] Implement Worker entrypoint.
  - [ ] Export default object.
  - [ ] Implement `fetch(request, env, ctx)`.
  - [ ] Implement `scheduled(event, env, ctx)`.
  - [ ] Route `/api/*` requests to API handlers.
  - [ ] Route non-API requests to static assets.
  - [ ] Return 404 for unknown API routes.
  - [ ] Return JSON errors for API errors.

---

# Phase 2 — Cloudflare Free-Tier Setup

## 2.1 Create Cloudflare D1 database

- [ ] Create the D1 database.
  - [ ] Name it `spam-triage-db`.
  - [ ] Copy the generated database ID.
  - [ ] Add the database ID to `wrangler.jsonc`.
  - [ ] Bind it as `DB`.

- [ ] Keep D1 usage minimal.
  - [ ] Store only required rows.
  - [ ] Use indexes only where needed.
  - [ ] Do not store large text blobs.
  - [ ] Do not store uploaded files.
  - [ ] Do not store raw phone numbers.
  - [ ] Do not use D1 for analytics events.

---

## 2.2 Configure Worker secrets

- [ ] Generate a strong `HASH_SECRET`.
  - [ ] Use a long random value.
  - [ ] Store it as a Worker secret.
  - [ ] Never commit it to Git.
  - [ ] Do not expose it to frontend code.

- [ ] Configure `TURNSTILE_SECRET_KEY`.
  - [ ] Create a Turnstile site in Cloudflare.
  - [ ] Store the secret key as a Worker secret.
  - [ ] Never validate Turnstile on the frontend only.

- [ ] Configure `ADMIN_PASSWORD`.
  - [ ] Generate a strong admin password.
  - [ ] Store it as a Worker secret.
  - [ ] Do not commit it.
  - [ ] Use it only for MVP admin access.

- [ ] Create `.dev.vars` for local development.
  - [ ] Add local `HASH_SECRET`.
  - [ ] Add local `TURNSTILE_SECRET_KEY`.
  - [ ] Add local `ADMIN_PASSWORD`.
  - [ ] Keep `.dev.vars` ignored by Git.

---

## 2.3 Configure Turnstile

- [ ] Create a Turnstile widget.
  - [ ] Add the production domain.
  - [ ] Add the local development domain if supported.
  - [ ] Copy the site key.
  - [ ] Add the site key to frontend environment config.

- [ ] Add frontend environment variable.
  - [ ] Create `.env.example`.
  - [ ] Add `VITE_TURNSTILE_SITE_KEY=`.
  - [ ] Do not include the secret key in frontend env vars.

- [ ] Decide protected forms.
  - [ ] Protect report submission.
  - [ ] Protect removal request submission.
  - [ ] Protect removal contest submission.
  - [ ] Do not require Turnstile for read-only search.

---

# Phase 3 — Database Schema

## 3.1 Create the `numbers` table

- [ ] Add `numbers` table to `migrations/0001_initial.sql`.
  - [ ] Add `id INTEGER PRIMARY KEY AUTOINCREMENT`.
  - [ ] Add `number_hash TEXT NOT NULL UNIQUE`.
  - [ ] Add `display_mask TEXT NOT NULL`.
  - [ ] Add `country_code TEXT`.
  - [ ] Add `status TEXT NOT NULL DEFAULT 'pending'`.
  - [ ] Add `report_count INTEGER NOT NULL DEFAULT 0`.
  - [ ] Add `unique_reporter_count INTEGER NOT NULL DEFAULT 0`.
  - [ ] Add `removal_request_id INTEGER`.
  - [ ] Add `first_reported_at TEXT NOT NULL`.
  - [ ] Add `last_reported_at TEXT NOT NULL`.
  - [ ] Add `updated_at TEXT NOT NULL`.

- [ ] Add indexes for `numbers`.
  - [ ] Add unique index on `number_hash`.
  - [ ] Add index on `status`.

- [ ] Enforce status values in application code.
  - [ ] Allow `pending`.
  - [ ] Allow `suspected`.
  - [ ] Allow `verified_spam`.
  - [ ] Allow `under_removal_review`.
  - [ ] Allow `removed`.
  - [ ] Allow `disputed`.

---

## 3.2 Create the `reports` table

- [ ] Add `reports` table.
  - [ ] Add `id INTEGER PRIMARY KEY AUTOINCREMENT`.
  - [ ] Add `number_id INTEGER NOT NULL`.
  - [ ] Add `reporter_hash TEXT NOT NULL`.
  - [ ] Add `category TEXT NOT NULL`.
  - [ ] Add `created_at TEXT NOT NULL`.
  - [ ] Add foreign key to `numbers(id)`.

- [ ] Add duplicate prevention.
  - [ ] Add `UNIQUE(number_id, reporter_hash)`.
  - [ ] Ensure duplicate reports do not increase report count.
  - [ ] Return existing status if duplicate report is submitted.

- [ ] Add index.
  - [ ] Add index on `number_id`.

- [ ] Restrict allowed categories.
  - [ ] Allow `scam`.
  - [ ] Allow `phishing`.
  - [ ] Allow `loan_spam`.
  - [ ] Allow `robocall`.
  - [ ] Allow `impersonation`.
  - [ ] Allow `delivery_scam`.
  - [ ] Allow `bank_scam`.
  - [ ] Allow `unknown`.

---

## 3.3 Create the `removal_requests` table

- [ ] Add `removal_requests` table.
  - [ ] Add `id INTEGER PRIMARY KEY AUTOINCREMENT`.
  - [ ] Add `number_id INTEGER NOT NULL`.
  - [ ] Add `requester_hash TEXT NOT NULL`.
  - [ ] Add `reason TEXT NOT NULL`.
  - [ ] Add `status TEXT NOT NULL DEFAULT 'open'`.
  - [ ] Add `contest_deadline TEXT NOT NULL`.
  - [ ] Add `created_at TEXT NOT NULL`.
  - [ ] Add `updated_at TEXT NOT NULL`.
  - [ ] Add foreign key to `numbers(id)`.

- [ ] Add indexes.
  - [ ] Add index on `(status, contest_deadline)`.
  - [ ] Add index on `number_id`.

- [ ] Restrict allowed removal reasons.
  - [ ] Allow `personal_number`.
  - [ ] Allow `incorrect_report`.
  - [ ] Allow `recycled_number`.
  - [ ] Allow `legitimate_business`.
  - [ ] Allow `other`.

- [ ] Restrict allowed removal statuses.
  - [ ] Allow `open`.
  - [ ] Allow `approved`.
  - [ ] Allow `contested`.
  - [ ] Allow `rejected`.

---

## 3.4 Create the `removal_contests` table

- [ ] Add `removal_contests` table.
  - [ ] Add `id INTEGER PRIMARY KEY AUTOINCREMENT`.
  - [ ] Add `removal_request_id INTEGER NOT NULL`.
  - [ ] Add `contestant_hash TEXT NOT NULL`.
  - [ ] Add `reason TEXT NOT NULL`.
  - [ ] Add `created_at TEXT NOT NULL`.
  - [ ] Add foreign key to `removal_requests(id)`.

- [ ] Add duplicate prevention.
  - [ ] Add `UNIQUE(removal_request_id, contestant_hash)`.
  - [ ] Ensure one contestant can only contest once per removal request.

- [ ] Add indexes.
  - [ ] Add index on `removal_request_id`.

- [ ] Restrict allowed contest reasons.
  - [ ] Allow `still_spam`.
  - [ ] Allow `recent_spam_call`.
  - [ ] Allow `known_scam_number`.
  - [ ] Allow `other`.

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

- [ ] Create `worker/lib/phone.ts`.
  - [ ] Import `parsePhoneNumberFromString` from `libphonenumber-js`.
  - [ ] Accept input phone number string.
  - [ ] Accept country code string.
  - [ ] Trim whitespace.
  - [ ] Parse with country fallback.
  - [ ] Reject invalid numbers.
  - [ ] Return E.164 normalized number.
  - [ ] Return country code.
  - [ ] Return public display mask.

- [ ] Implement display masking.
  - [ ] Preserve country code when available.
  - [ ] Show first useful prefix.
  - [ ] Hide middle digits.
  - [ ] Show last 4 digits.
  - [ ] Example output: `+63 917 *** 4567`.

- [ ] Add phone validation tests.
  - [ ] Test valid Philippine mobile numbers.
  - [ ] Test valid international E.164 numbers.
  - [ ] Test invalid short numbers.
  - [ ] Test letters in phone input.
  - [ ] Test empty input.

---

## 4.2 Implement HMAC hashing

- [ ] Create `worker/lib/hash.ts`.
  - [ ] Implement `hmacSha256(secret, value)`.
  - [ ] Use Web Crypto API.
  - [ ] Return lowercase hex string.
  - [ ] Do not use plain SHA-256.

- [ ] Implement number hashing.
  - [ ] Normalize number first.
  - [ ] HMAC normalized number with `HASH_SECRET`.
  - [ ] Store result as `number_hash`.

- [ ] Implement reporter hashing.
  - [ ] Create stable reporter key from available request data.
  - [ ] Use Turnstile result plus IP hash where available.
  - [ ] Avoid storing raw IP.
  - [ ] HMAC reporter key with `HASH_SECRET`.
  - [ ] Store only `reporter_hash`.

- [ ] Implement requester hashing.
  - [ ] Use same approach as reporter hashing.
  - [ ] Store only `requester_hash`.

- [ ] Implement contestant hashing.
  - [ ] Use same approach as reporter hashing.
  - [ ] Store only `contestant_hash`.

---

## 4.3 Implement status scoring

- [ ] Create `worker/lib/scoring.ts`.
  - [ ] Export `computeNumberStatus`.
  - [ ] Accept unique reporter count.
  - [ ] Accept existing number status.
  - [ ] Preserve `removed` status unless a new valid report reopens review.
  - [ ] Preserve `under_removal_review` while removal request is open.
  - [ ] Preserve `disputed` until admin resolves.

- [ ] Implement MVP scoring rules.
  - [ ] Return `pending` for 1 unique report.
  - [ ] Return `suspected` for 2 unique reports.
  - [ ] Return `verified_spam` for 3 or more unique reports.
  - [ ] Return `under_removal_review` when an open removal request exists.
  - [ ] Return `disputed` when a removal contest exists.
  - [ ] Return `removed` when removal is approved.

- [ ] Do not implement ML scoring.
- [ ] Do not implement weighted reputation.
- [ ] Do not implement paid external checks.

---

## 4.4 Implement JSON response helpers

- [ ] Create `worker/lib/http.ts`.
  - [ ] Implement `json(data, status)`.
  - [ ] Implement `jsonError(message, status, code)`.
  - [ ] Set `content-type` to `application/json`.
  - [ ] Avoid leaking stack traces.
  - [ ] Return stable error codes.

- [ ] Standardize success responses.
  - [ ] Include `ok: true`.
  - [ ] Include relevant data.
  - [ ] Do not return internal IDs unless needed by frontend.
  - [ ] Do not return number hash unless required for public route.

- [ ] Standardize error responses.
  - [ ] Include `ok: false`.
  - [ ] Include `error.code`.
  - [ ] Include `error.message`.
  - [ ] Do not expose secrets.
  - [ ] Do not expose raw SQL errors.

---

## 4.5 Implement Turnstile verification

- [ ] Create `worker/lib/turnstile.ts`.
  - [ ] Accept token.
  - [ ] Accept remote IP when available.
  - [ ] POST to Turnstile verification endpoint.
  - [ ] Use `TURNSTILE_SECRET_KEY`.
  - [ ] Return success or failure.
  - [ ] Reject missing tokens.
  - [ ] Reject invalid tokens.
  - [ ] Reject expired tokens.

- [ ] Use Turnstile on write endpoints.
  - [ ] Validate before report insertion.
  - [ ] Validate before removal request creation.
  - [ ] Validate before removal contest creation.

- [ ] Do not use Turnstile on read-only endpoints.
  - [ ] Do not require it for checking a number.
  - [ ] Do not require it for viewing a removal request.

---

# Phase 5 — Worker API

## 5.1 Implement API router

- [ ] Implement path routing in `worker/index.ts`.
  - [ ] Route `GET /api/health`.
  - [ ] Route `POST /api/reports`.
  - [ ] Route `GET /api/numbers/check`.
  - [ ] Route `POST /api/removal-requests`.
  - [ ] Route `GET /api/removal-requests/:id`.
  - [ ] Route `POST /api/removal-requests/:id/contest`.
  - [ ] Route `GET /api/admin/summary`.
  - [ ] Route `GET /api/admin/removal-requests`.
  - [ ] Route `POST /api/admin/removal-requests/:id/resolve`.

- [ ] Enforce HTTP methods.
  - [ ] Return 405 for unsupported methods.
  - [ ] Return 404 for unknown routes.
  - [ ] Return JSON for API errors.

---

## 5.2 Implement health endpoint

- [ ] Implement `GET /api/health`.
  - [ ] Return `ok: true`.
  - [ ] Return app name.
  - [ ] Return environment if safe.
  - [ ] Do not query D1.
  - [ ] Do not expose secrets.

---

## 5.3 Implement report endpoint

- [ ] Implement `POST /api/reports`.
  - [ ] Parse JSON body.
  - [ ] Validate body with Zod.
  - [ ] Require `phoneNumber`.
  - [ ] Require `country`.
  - [ ] Require `category`.
  - [ ] Require `turnstileToken`.
  - [ ] Reject unknown categories.
  - [ ] Reject invalid phone numbers.
  - [ ] Validate Turnstile token.
  - [ ] Normalize phone number.
  - [ ] HMAC hash normalized number.
  - [ ] Generate display mask.
  - [ ] Generate reporter hash.
  - [ ] Look up number by `number_hash`.
  - [ ] Create number row if missing.
  - [ ] Insert report with `UNIQUE(number_id, reporter_hash)`.
  - [ ] Do not increase count if duplicate.
  - [ ] Recalculate report count.
  - [ ] Recalculate unique reporter count.
  - [ ] Recompute number status.
  - [ ] Update number row.
  - [ ] Return masked number.
  - [ ] Return status.
  - [ ] Return report count.
  - [ ] Return duplicate flag when applicable.

- [ ] Keep report payload small.
  - [ ] Do not accept report descriptions for MVP.
  - [ ] Do not accept evidence uploads.
  - [ ] Do not accept attachments.
  - [ ] Do not accept user identity fields.

---

## 5.4 Implement number check endpoint

- [ ] Implement `GET /api/numbers/check`.
  - [ ] Read `number` query parameter.
  - [ ] Read optional `country` query parameter.
  - [ ] Reject missing number.
  - [ ] Normalize number.
  - [ ] Hash normalized number.
  - [ ] Look up number by `number_hash`.
  - [ ] Return `found: false` if missing.
  - [ ] Return masked number if found.
  - [ ] Return status if found.
  - [ ] Return report count if found.
  - [ ] Return unique reporter count if found.
  - [ ] Return removal status if under removal review.
  - [ ] Do not return internal number ID.
  - [ ] Do not return reporter hashes.
  - [ ] Do not return raw phone number.

- [ ] Keep search cheap.
  - [ ] Use indexed `number_hash` lookup.
  - [ ] Do not perform fuzzy search.
  - [ ] Do not allow listing all numbers.
  - [ ] Do not expose autocomplete for MVP.

---

## 5.5 Implement removal request creation

- [ ] Implement `POST /api/removal-requests`.
  - [ ] Parse JSON body.
  - [ ] Validate body with Zod.
  - [ ] Require `phoneNumber`.
  - [ ] Require `country`.
  - [ ] Require `reason`.
  - [ ] Require `turnstileToken`.
  - [ ] Reject unknown removal reasons.
  - [ ] Validate Turnstile token.
  - [ ] Normalize phone number.
  - [ ] Hash normalized number.
  - [ ] Look up existing number.
  - [ ] Create a number row if it does not exist.
  - [ ] Prevent multiple open removal requests for the same number.
  - [ ] Create removal request with `contest_deadline = now + 7 days`.
  - [ ] Set removal request status to `open`.
  - [ ] Update number status to `under_removal_review`.
  - [ ] Store removal request ID on number row.
  - [ ] Return removal request ID.
  - [ ] Return contest deadline.
  - [ ] Return masked number.

- [ ] Keep removal requests simple.
  - [ ] Do not request proof documents.
  - [ ] Do not allow file uploads.
  - [ ] Do not collect email address for MVP.
  - [ ] Do not notify users by email.

---

## 5.6 Implement removal request details

- [ ] Implement `GET /api/removal-requests/:id`.
  - [ ] Validate ID is numeric.
  - [ ] Look up removal request.
  - [ ] Join related number row.
  - [ ] Count contests.
  - [ ] Return masked number.
  - [ ] Return removal reason.
  - [ ] Return removal status.
  - [ ] Return contest deadline.
  - [ ] Return contest count.
  - [ ] Return whether contest window is still open.
  - [ ] Do not return requester hash.
  - [ ] Do not return contestant hashes.

---

## 5.7 Implement removal contest endpoint

- [ ] Implement `POST /api/removal-requests/:id/contest`.
  - [ ] Validate ID is numeric.
  - [ ] Parse JSON body.
  - [ ] Validate body with Zod.
  - [ ] Require `reason`.
  - [ ] Require `turnstileToken`.
  - [ ] Reject unknown contest reasons.
  - [ ] Validate Turnstile token.
  - [ ] Look up removal request.
  - [ ] Reject missing removal request.
  - [ ] Reject non-open removal request.
  - [ ] Reject contest after deadline.
  - [ ] Generate contestant hash.
  - [ ] Insert contest with uniqueness rule.
  - [ ] Do not duplicate contest from same contestant.
  - [ ] Set number status to `disputed`.
  - [ ] Return contest count.
  - [ ] Return number status.

- [ ] Keep contest simple.
  - [ ] Do not accept attachments.
  - [ ] Do not accept long descriptions.
  - [ ] Do not show public comments.

---

# Phase 6 — Scheduled 7-Day Finalizer

## 6.1 Implement scheduled Worker handler

- [ ] Add `scheduled(event, env, ctx)` in Worker entrypoint.
  - [ ] Call `finalizeRemovalRequests(env)`.
  - [ ] Catch errors.
  - [ ] Do not throw unhandled exceptions.
  - [ ] Keep work bounded.
  - [ ] Process a limited batch per run.
  - [ ] Use daily cron only.

---

## 6.2 Implement finalizer job

- [ ] Create `worker/jobs/finalize-removals.ts`.
  - [ ] Query open removal requests where `contest_deadline <= now`.
  - [ ] Limit batch size to 100.
  - [ ] For each open removal request, count contests.
  - [ ] If contest count is 0, approve removal.
  - [ ] If contest count is greater than 0, mark as contested.
  - [ ] Update related number status.
  - [ ] Save updated timestamps.

- [ ] Implement no-contest approval.
  - [ ] Set `removal_requests.status = 'approved'`.
  - [ ] Set `numbers.status = 'removed'`.
  - [ ] Keep report rows for historical deduplication.
  - [ ] Do not publicly expose removed numbers as active spam.

- [ ] Implement contested handling.
  - [ ] Set `removal_requests.status = 'contested'`.
  - [ ] Set `numbers.status = 'disputed'`.
  - [ ] Require admin review later.

- [ ] Keep cron free-tier friendly.
  - [ ] Run once per day.
  - [ ] Do not scan the entire database.
  - [ ] Use index on `(status, contest_deadline)`.
  - [ ] Limit batch size.
  - [ ] Do not generate emails.
  - [ ] Do not call external APIs.

---

# Phase 7 — Frontend Foundation

## 7.1 Create app shell

- [ ] Implement base layout.
  - [ ] Add header.
  - [ ] Add navigation links.
  - [ ] Add main content area.
  - [ ] Add footer.
  - [ ] Add privacy-first message in footer.

- [ ] Create navigation routes.
  - [ ] Route `/` to homepage.
  - [ ] Route `/check` to number checker page.
  - [ ] Route `/report` to report page.
  - [ ] Route `/remove` to removal request page.
  - [ ] Route `/removal/:id` to removal request detail page.
  - [ ] Route `/admin` to basic admin page.
  - [ ] Route unknown paths to not-found page.

- [ ] Keep bundle small.
  - [ ] Do not add heavy component frameworks.
  - [ ] Do not add chart libraries for MVP.
  - [ ] Do not add animation libraries for MVP.
  - [ ] Do not add map libraries.

---

## 7.2 Implement API client

- [ ] Create `src/api/client.ts`.
  - [ ] Implement `apiGet`.
  - [ ] Implement `apiPost`.
  - [ ] Parse JSON responses.
  - [ ] Handle non-2xx responses.
  - [ ] Convert API error response into frontend error object.
  - [ ] Do not hardcode production domain.
  - [ ] Use relative `/api` URLs.

- [ ] Create API functions.
  - [ ] Create `checkNumber`.
  - [ ] Create `submitReport`.
  - [ ] Create `createRemovalRequest`.
  - [ ] Create `getRemovalRequest`.
  - [ ] Create `contestRemovalRequest`.
  - [ ] Create `getAdminSummary`.
  - [ ] Create `getAdminRemovalRequests`.
  - [ ] Create `resolveAdminRemovalRequest`.

---

## 7.3 Create shared UI components

- [ ] Create `Button` component.
  - [ ] Support primary variant.
  - [ ] Support secondary variant.
  - [ ] Support disabled state.
  - [ ] Support loading state.

- [ ] Create `Input` component.
  - [ ] Support label.
  - [ ] Support error message.
  - [ ] Support helper text.

- [ ] Create `Select` component.
  - [ ] Support label.
  - [ ] Support options.
  - [ ] Support error message.

- [ ] Create `Card` component.
  - [ ] Use for result displays.
  - [ ] Use for forms.
  - [ ] Use for status summaries.

- [ ] Create `StatusBadge` component.
  - [ ] Render `pending`.
  - [ ] Render `suspected`.
  - [ ] Render `verified_spam`.
  - [ ] Render `under_removal_review`.
  - [ ] Render `removed`.
  - [ ] Render `disputed`.

- [ ] Create `TurnstileWidget` component.
  - [ ] Load Turnstile script.
  - [ ] Render widget using `VITE_TURNSTILE_SITE_KEY`.
  - [ ] Emit token to form state.
  - [ ] Reset token after submission.

---

# Phase 8 — Frontend Pages

## 8.1 Homepage

- [ ] Implement homepage.
  - [ ] Explain that the system is community-based.
  - [ ] Explain that multiple unique reports increase spam confidence.
  - [ ] Explain that removal requests have a 7-day contest period.
  - [ ] Explain that the system stores hashes and masked numbers.
  - [ ] Add call-to-action to check a number.
  - [ ] Add call-to-action to report a number.
  - [ ] Add call-to-action to request removal.

- [ ] Add free-tier/open-source transparency.
  - [ ] State that the project avoids accounts, uploads, and tracking for MVP.
  - [ ] State that data collection is intentionally minimal.
  - [ ] State that abuse protection uses Turnstile.

---

## 8.2 Check number page

- [ ] Implement `/check`.
  - [ ] Add phone-number input.
  - [ ] Add country selector.
  - [ ] Default country to `PH`.
  - [ ] Add submit button.
  - [ ] Call `GET /api/numbers/check`.
  - [ ] Display loading state.
  - [ ] Display errors.
  - [ ] Display result.

- [ ] Implement result states.
  - [ ] Show `No reports found` when `found` is false.
  - [ ] Show masked number when found.
  - [ ] Show status badge.
  - [ ] Show report count.
  - [ ] Show unique reporter count.
  - [ ] Show removal deadline if under removal review.
  - [ ] Show link to report again.
  - [ ] Show link to request removal.

- [ ] Keep read endpoint free-tier friendly.
  - [ ] Do not auto-query while typing.
  - [ ] Query only when the user submits.
  - [ ] Do not add autocomplete.
  - [ ] Do not list recent numbers.

---

## 8.3 Report page

- [ ] Implement `/report`.
  - [ ] Add phone-number input.
  - [ ] Add country selector.
  - [ ] Default country to `PH`.
  - [ ] Add spam category select.
  - [ ] Add Turnstile widget.
  - [ ] Add submit button.
  - [ ] Validate form with Zod.
  - [ ] Call `POST /api/reports`.
  - [ ] Reset Turnstile after submission.
  - [ ] Display success result.
  - [ ] Display duplicate report message when duplicate.
  - [ ] Display current number status.

- [ ] Implement category options.
  - [ ] Scam.
  - [ ] Phishing.
  - [ ] Loan spam.
  - [ ] Robocall.
  - [ ] Impersonation.
  - [ ] Delivery scam.
  - [ ] Bank scam.
  - [ ] Unknown.

- [ ] Keep form abuse-resistant.
  - [ ] Require Turnstile.
  - [ ] Do not allow descriptions.
  - [ ] Do not allow attachments.
  - [ ] Do not allow batch reporting.
  - [ ] Do not submit automatically.

---

## 8.4 Removal request page

- [ ] Implement `/remove`.
  - [ ] Add phone-number input.
  - [ ] Add country selector.
  - [ ] Default country to `PH`.
  - [ ] Add removal reason select.
  - [ ] Add Turnstile widget.
  - [ ] Add submit button.
  - [ ] Validate form with Zod.
  - [ ] Call `POST /api/removal-requests`.
  - [ ] Display removal request ID.
  - [ ] Display masked number.
  - [ ] Display contest deadline.
  - [ ] Link to `/removal/:id`.

- [ ] Implement removal reasons.
  - [ ] Personal number.
  - [ ] Incorrect report.
  - [ ] Recycled number.
  - [ ] Legitimate business.
  - [ ] Other.

- [ ] Explain rules on the page.
  - [ ] Explain that removal is not immediate.
  - [ ] Explain that the contest period lasts 7 days.
  - [ ] Explain that no contest means the number will be removed.
  - [ ] Explain that a contest means the number becomes disputed.

---

## 8.5 Removal detail and contest page

- [ ] Implement `/removal/:id`.
  - [ ] Fetch removal request details.
  - [ ] Display masked number.
  - [ ] Display removal status.
  - [ ] Display removal reason.
  - [ ] Display contest deadline.
  - [ ] Display contest count.
  - [ ] Display whether the contest window is open.
  - [ ] Show contest form only when status is `open` and deadline has not passed.

- [ ] Implement contest form.
  - [ ] Add contest reason select.
  - [ ] Add Turnstile widget.
  - [ ] Add submit button.
  - [ ] Validate with Zod.
  - [ ] Call `POST /api/removal-requests/:id/contest`.
  - [ ] Show success message.
  - [ ] Refresh removal request details.

- [ ] Implement contest reasons.
  - [ ] Still spam.
  - [ ] Recent spam call.
  - [ ] Known scam number.
  - [ ] Other.

---

# Phase 9 — Basic Admin MVP

## 9.1 Implement admin authentication

- [ ] Use password-only admin access for MVP.
  - [ ] Add password input on `/admin`.
  - [ ] Send password as `Authorization: Bearer <password>`.
  - [ ] Compare against `ADMIN_PASSWORD` in Worker.
  - [ ] Do not store admin password in localStorage.
  - [ ] Keep password only in memory state during session.
  - [ ] Clear password when tab reloads.

- [ ] Protect admin API routes.
  - [ ] Require `Authorization` header.
  - [ ] Reject missing token.
  - [ ] Reject incorrect token.
  - [ ] Return 401 JSON error.

---

## 9.2 Implement admin summary endpoint

- [ ] Implement `GET /api/admin/summary`.
  - [ ] Count total numbers.
  - [ ] Count pending numbers.
  - [ ] Count suspected numbers.
  - [ ] Count verified spam numbers.
  - [ ] Count under-removal-review numbers.
  - [ ] Count disputed numbers.
  - [ ] Count removed numbers.
  - [ ] Count open removal requests.
  - [ ] Count contested removal requests.
  - [ ] Keep queries simple.
  - [ ] Do not compute expensive analytics.

---

## 9.3 Implement admin removal review endpoint

- [ ] Implement `GET /api/admin/removal-requests`.
  - [ ] Return open and contested removal requests.
  - [ ] Limit results to 100.
  - [ ] Include masked number.
  - [ ] Include status.
  - [ ] Include reason.
  - [ ] Include contest count.
  - [ ] Include contest deadline.
  - [ ] Sort by newest first.

- [ ] Implement frontend admin list.
  - [ ] Show removal request rows.
  - [ ] Show masked number.
  - [ ] Show status.
  - [ ] Show reason.
  - [ ] Show contest count.
  - [ ] Show deadline.
  - [ ] Add approve button.
  - [ ] Add reject button.
  - [ ] Add mark disputed button.

---

## 9.4 Implement admin resolution endpoint

- [ ] Implement `POST /api/admin/removal-requests/:id/resolve`.
  - [ ] Require admin auth.
  - [ ] Validate request ID.
  - [ ] Validate action.
  - [ ] Allow action `approve_removal`.
  - [ ] Allow action `reject_removal`.
  - [ ] Allow action `mark_disputed`.

- [ ] Implement approve removal.
  - [ ] Set removal request status to `approved`.
  - [ ] Set number status to `removed`.

- [ ] Implement reject removal.
  - [ ] Set removal request status to `rejected`.
  - [ ] Recompute number status from unique report count.

- [ ] Implement mark disputed.
  - [ ] Set removal request status to `contested`.
  - [ ] Set number status to `disputed`.

- [ ] Keep admin minimal.
  - [ ] Do not add role management.
  - [ ] Do not add user accounts.
  - [ ] Do not add activity timeline for MVP.

---

# Phase 10 — Privacy and Security

## 10.1 Enforce privacy constraints

- [ ] Never store plain raw phone numbers.
  - [ ] Normalize phone number in memory only.
  - [ ] Generate HMAC hash.
  - [ ] Store HMAC hash.
  - [ ] Generate display mask.
  - [ ] Store display mask.
  - [ ] Discard raw normalized number.

- [ ] Never expose sensitive fields in API.
  - [ ] Do not return `number_hash`.
  - [ ] Do not return `reporter_hash`.
  - [ ] Do not return `requester_hash`.
  - [ ] Do not return `contestant_hash`.
  - [ ] Do not return IP-derived values.
  - [ ] Do not return database internals unless necessary.

- [ ] Use minimal data collection.
  - [ ] Store report category.
  - [ ] Store removal reason.
  - [ ] Store contest reason.
  - [ ] Store timestamps.
  - [ ] Do not store names.
  - [ ] Do not store emails.
  - [ ] Do not store accounts.
  - [ ] Do not store free-form evidence text for MVP.

---

## 10.2 Add input validation

- [ ] Validate all request bodies with Zod.
  - [ ] Validate report body.
  - [ ] Validate removal request body.
  - [ ] Validate contest body.
  - [ ] Validate admin resolve body.

- [ ] Validate query parameters.
  - [ ] Validate phone number query parameter.
  - [ ] Validate country query parameter.
  - [ ] Validate numeric IDs.

- [ ] Reject large payloads.
  - [ ] Limit JSON body size in Worker logic.
  - [ ] Reject bodies over 10 KB.
  - [ ] Do not accept arrays for report submissions.
  - [ ] Do not accept nested arbitrary objects.

---

## 10.3 Add basic abuse limits

- [ ] Use Turnstile on writes.
  - [ ] Report endpoint.
  - [ ] Removal request endpoint.
  - [ ] Removal contest endpoint.

- [ ] Use database uniqueness as anti-spam.
  - [ ] One report per number per reporter hash.
  - [ ] One contest per removal request per contestant hash.
  - [ ] One open removal request per number.

- [ ] Keep manual D1 rate-limit table optional.
  - [ ] Do not implement it before launch unless spam appears.
  - [ ] Prefer Turnstile plus uniqueness first.
  - [ ] Add rate-limit table only if needed.

---

# Phase 11 — Free-Tier Cost Controls

## 11.1 Worker request controls

- [ ] Avoid unnecessary API requests.
  - [ ] Do not auto-search while user types.
  - [ ] Do not poll removal request pages.
  - [ ] Do not refresh admin dashboard automatically.
  - [ ] Do not send analytics events.
  - [ ] Do not perform background client requests.

- [ ] Keep API responses small.
  - [ ] Return only required fields.
  - [ ] Do not return lists of public numbers.
  - [ ] Do not expose raw database rows.
  - [ ] Do not include large descriptions.

- [ ] Cache static assets.
  - [ ] Let Cloudflare cache built frontend assets.
  - [ ] Use hashed Vite asset filenames.
  - [ ] Avoid dynamic rendering for normal pages.

---

## 11.2 D1 usage controls

- [ ] Use indexed lookups.
  - [ ] Search numbers by `number_hash`.
  - [ ] Query removal jobs by `status` and `contest_deadline`.
  - [ ] Query reports by `number_id`.

- [ ] Avoid expensive database features.
  - [ ] Do not use full-text search.
  - [ ] Do not use fuzzy search.
  - [ ] Do not use analytics aggregation on every page load.
  - [ ] Do not list all reports publicly.
  - [ ] Do not store logs for every request.

- [ ] Keep tables small.
  - [ ] Do not store uploaded files.
  - [ ] Do not store comments.
  - [ ] Do not store long descriptions.
  - [ ] Do not store raw phone numbers.

---

## 11.3 Cron controls

- [ ] Run cron once daily only.
  - [ ] Use `0 0 * * *`.
  - [ ] Process only due open removal requests.
  - [ ] Limit processing to 100 rows per run.
  - [ ] Do not scan all reports.
  - [ ] Do not call external APIs.
  - [ ] Do not send notifications.

---

## 11.4 Launch traffic controls

- [ ] Add simple public messaging.
  - [ ] Explain this is a community project.
  - [ ] Explain reports are rate-limited by abuse protection.
  - [ ] Explain data is minimal.

- [ ] Prepare abuse fallback.
  - [ ] Be ready to temporarily disable report submissions.
  - [ ] Be ready to temporarily disable removal contests.
  - [ ] Be ready to add stricter Turnstile settings.
  - [ ] Be ready to add Cloudflare firewall rules.

---

# Phase 12 — Testing

## 12.1 Unit tests

- [ ] Test phone normalization.
  - [ ] Valid PH number.
  - [ ] Valid E.164 number.
  - [ ] Invalid number.
  - [ ] Empty string.
  - [ ] Number with spaces and dashes.

- [ ] Test masking.
  - [ ] Mask PH mobile number.
  - [ ] Mask international number.
  - [ ] Never expose full number.

- [ ] Test scoring.
  - [ ] 1 report returns `pending`.
  - [ ] 2 reports return `suspected`.
  - [ ] 3 reports return `verified_spam`.
  - [ ] Open removal returns `under_removal_review`.
  - [ ] Contest returns `disputed`.
  - [ ] Approved removal returns `removed`.

- [ ] Test validation schemas.
  - [ ] Valid report body.
  - [ ] Invalid category.
  - [ ] Missing Turnstile token.
  - [ ] Invalid removal reason.
  - [ ] Invalid contest reason.

---

## 12.2 API integration tests

- [ ] Test report submission.
  - [ ] Submit first report.
  - [ ] Confirm status is `pending`.
  - [ ] Submit duplicate report.
  - [ ] Confirm count does not increase.
  - [ ] Submit reports from different reporter hashes.
  - [ ] Confirm status changes to `suspected`.
  - [ ] Confirm status changes to `verified_spam`.

- [ ] Test number check.
  - [ ] Check missing number.
  - [ ] Confirm `found: false`.
  - [ ] Check reported number.
  - [ ] Confirm masked number is returned.
  - [ ] Confirm raw number is not returned.

- [ ] Test removal request.
  - [ ] Create removal request.
  - [ ] Confirm 7-day deadline.
  - [ ] Confirm number status becomes `under_removal_review`.
  - [ ] Prevent duplicate open removal request.

- [ ] Test contest flow.
  - [ ] Contest open removal request.
  - [ ] Confirm contest count increases.
  - [ ] Confirm number becomes `disputed`.
  - [ ] Prevent duplicate contest.

- [ ] Test finalizer.
  - [ ] Finalize open request with no contests.
  - [ ] Confirm number becomes `removed`.
  - [ ] Finalize open request with contests.
  - [ ] Confirm number becomes `disputed`.

---

## 12.3 Manual browser tests

- [ ] Test homepage on mobile width.
- [ ] Test homepage on desktop width.
- [ ] Test report form success.
- [ ] Test report form validation errors.
- [ ] Test check form success.
- [ ] Test check form missing result.
- [ ] Test removal request success.
- [ ] Test contest success.
- [ ] Test admin password failure.
- [ ] Test admin password success.
- [ ] Test admin resolve actions.

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
