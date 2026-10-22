# spam-triage

Vite + React + TypeScript app with React Compiler enabled.

## Scripts

- `npm run dev` start Vite dev server.
- `npm run dev:worker` start local Cloudflare Worker API.
- `npm run build` type-check and build production bundle.
- `npm run deploy` build app, apply remote D1 migrations, deploy Worker + static assets.
- `npm run lint` run Biome checks.
- `npm run format` apply Biome fixes and formatting.
- `npm run typecheck` run TypeScript project builds.
- `npm test` run the Worker test suite against an in-memory SQLite database.
- `npm run preview` serve built app locally.

## Tooling

- Node 24 or newer (the test harness uses `node:sqlite`).
- Biome config in `biome.json`.
- TypeScript project refs in `tsconfig*.json`.
- Vite config in `vite.config.ts`.

## Intentionally Not Included

- user accounts or profiles
- email or SMS verification
- file or image evidence uploads
- analytics, ads, or behavioral tracking
- paid infrastructure or external phone lookup APIs
- passwords or admin session tokens inside the Worker

## Admin Route

- Set `VITE_HIDDEN_ADMIN_PATH` in `.env` for local frontend route; production builds read it from the build environment (or `.env` when present).
- Optional: set `VITE_API_PROXY_TARGET` in `.env` if Worker dev server is not on `http://127.0.0.1:8787`.
- Set `VITE_TURNSTILE_SITE_KEY` in `.env`; public check, report, and removal forms require Turnstile. Production builds read it from the build environment.
- Set `HIDDEN_ADMIN_PATH` in Worker env (`wrangler.jsonc`) or `.dev.vars` for backend route.
- `shared/admin-paths.ts` derives matching API paths from those env values.
- The admin path is obfuscation, not a secret: `VITE_*` values are inlined into the public JS bundle.
- **Admin authentication is handled by Cloudflare Access, not by the Worker.** Protect both the dashboard route (`/f4c9`) and its API base (`/api/f4c9/*`) with one Access application and policy; the app may contain multiple destinations, which share one AUD tag.
- The Worker does not trust header presence alone: it requires `Cf-Access-Authenticated-User-Email` and `Cf-Access-Jwt-Assertion`, then verifies the JWT signature against `https://$ACCESS_TEAM_DOMAIN/cdn-cgi/access/certs`, the `iss` host, the `ACCESS_AUD` audience, and `exp`/`nbf`. The operator email is read from the verified `email` claim.
- `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` live in `wrangler.jsonc` `vars` (both are public values). An empty or wrong value fails closed: admin API returns `401` and logs `Cloudflare Access configuration missing`, while public endpoints keep working.
- Access service-token JWTs carry `common_name` instead of `email`; they are rejected until a claim mapping is added.
- `workers_dev` is disabled and preview URLs are off so the custom domain is the only entry point.
- The dashboard route is served from static assets, so only Access protects it. The API is covered by Access at the edge and re-verified inside the Worker.
- Local development bypasses Access only when `ENVIRONMENT=development` and the request host is local.
- Removal request URLs use an unguessable public token, not the numeric row ID.
- Public navigation does not expose admin entry.

## Maintenance

Three staggered daily cron triggers keep each invocation inside the free-tier D1 query budget:

- `0 0 * * *` reconcile recent report counts/statuses, then finalize up to five 1,000-request batches of expired removal requests;
- `10 0 * * *` encrypt plaintext E.164 values and rehash legacy number hashes;
- `20 0 * * *` purge reports older than 12 months, resolved moderation records, and old audit rows.

Verified-spam removal requests are not auto-approved. They move to `pending_review` for operator adjudication. Low-confidence uncontested requests auto-approve after the 7-day challenge window.

## Data at Rest

- E.164 values are encrypted with AES-GCM; the key is derived from `HASH_SECRET` with a domain-separated label.
- Phone-number hashes and reporter hashes use a `v2:<key-fingerprint>:` prefix. The fingerprint is derived from the secret, is not secret itself, and lets rotation find rows produced by an older key. Number hashes are rehashed when a report touches a legacy row and by the 10:00 job.
- Reporter hashes use the request IP only. The client-controlled user-agent is excluded so it cannot be rotated to manufacture unique reporters. Reporter hashes cannot be rehashed because raw IPs are not retained; they are dual-read only while `HASH_SECRET_PREVIOUS` is set.
- Rotate in this order: set `HASH_SECRET_PREVIOUS` to the old value and `HASH_SECRET` to the new value in the same deploy, then let the 10:00 job drain number rows. Keep the previous secret for as long as you need legacy reporter dedupe; it also keeps the old AES-GCM key available for any row the number migration has not reached. After it is removed, old reporter hashes still count for confidence but no longer match new submissions. Never deploy the new secret without the previous one, or lookups can miss legacy number rows and create duplicate number records.
- `phone_number_e164` is written as `NULL` for new rows. The daily cron encrypts legacy plaintext rows in batches.
- Admin exports decrypt values in memory only.
- Admin actions are recorded in `admin_audit_log` with the Cloudflare Access operator email and retained for 24 months.

## Abuse Controls

- All public writes are Turnstile-protected, bound to a Turnstile action, and checked against the request hostname.
- `wrangler.jsonc` defines `RATE_LIMITER_WRITE` (10 requests / 60 seconds) and `RATE_LIMITER_READ` (60 requests / 60 seconds), keyed by IP and scope. The Worker falls back to `RATE_LIMITER` when those bindings are absent.
- Removal submissions have a per-reporter daily cap (5) and a 7-day cooldown after a rejected request.
- Uncontested verified-spam removals require operator review.

## Local Dev

- Run `npm run dev:worker` in one terminal.
- Run `npm run dev` in another terminal.
- Copy `.env.example` to `.env` and `.dev.vars.example` to `.dev.vars`.
- Keep `VITE_HIDDEN_ADMIN_PATH` and `HIDDEN_ADMIN_PATH` identical.
- Set `ENVIRONMENT=development` in `.dev.vars` when using Cloudflare test keys; Turnstile and Cloudflare Access checks are skipped only for local hostnames (`localhost`, `127.0.0.1`, `[::1]`, or `.local`).

## Deploy

### Git-connected builds (Cloudflare Workers Builds)

- Project root directory: `spam-triage`.
- Build command: `npm run build`.
- Deploy command: `npm run deploy` (applies remote D1 migrations, then `wrangler deploy`).
- `wrangler.jsonc` is committed, so Wrangler does not run its interactive setup during builds. It contains only non-secret values; keep secrets in Worker secrets.
- Add these **build** variables in the Cloudflare project settings (Build → Variables and secrets). They are inlined at build time; Worker runtime vars do not reach the bundle:

| Name | Value |
| --- | --- |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key (public) |
| `VITE_HIDDEN_ADMIN_PATH` | same value as `HIDDEN_ADMIN_PATH` in `wrangler.jsonc` |

- `npm run build` fails when either build variable is missing, so a misconfigured deploy cannot ship a blank app.
- If the build token cannot apply migrations, set the deploy command to `npx wrangler deploy` and apply migrations manually:

```bash
npx wrangler d1 migrations apply DB --remote
```

### Manual deploy

- Run `npm run deploy` for default environment.
- Run `npm run deploy -- --env <name>` for named Wrangler environment.
- Run `npm run deploy -- --skip-migrations` only if remote schema already current.
- Migration `0004` keeps the oldest open removal request per number and rejects duplicates before adding the unique index.
- Migration `0005` adds recent-activity counters, maintenance cursors, the audit log, and enum-validation triggers.
- Set Worker secrets before first deploy with `npx wrangler secret put`:

```bash
npx wrangler login
npx wrangler secret put HASH_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
# During key rotation only:
npx wrangler secret put HASH_SECRET_PREVIOUS
```

- For a named Wrangler environment, add `--env <name>`:

```bash
npx wrangler secret put HASH_SECRET --env production
npx wrangler secret put TURNSTILE_SECRET_KEY --env production
```

- `VITE_TURNSTILE_SITE_KEY` is public frontend config, not a Worker secret.
- Create one Cloudflare Access application covering both the hidden admin route (`/f4c9`) and its API base (`/api/f4c9/*`). Copy the application's AUD tag into `ACCESS_AUD` in `wrangler.jsonc`; set `ACCESS_TEAM_DOMAIN` to the Zero Trust team domain (`<team>.cloudflareaccess.com`). The Worker verifies the Access JWT, so a deleted, disabled, or mis-scoped Access app fails closed.
- After deploying, check that a logged-out request to `/f4c9` and `/api/f4c9/summary` returns a redirect to `cloudflareaccess.com` (or `403`), not a Worker JSON response.
- `ADMIN_PASSWORD` is no longer used. Remove the old secret with `npx wrangler secret delete ADMIN_PASSWORD`.
