# spam-triage

Vite + React + TypeScript app with React Compiler enabled.

## Scripts

- `npm run dev` start Vite dev server.
- `npm run dev:worker` start local Cloudflare Worker API.
- `npm run build` type-check and build production bundle.
- `npm run deploy` build app, apply remote D1 migrations, deploy Worker + static assets.
- `npm run lint` run Biome checks.
- `npm run format` apply Biome fixes and formatting.
- `npm run preview` serve built app locally.

## Tooling

- Biome config in `biome.json`.
- TypeScript project refs in `tsconfig*.json`.
- Vite config in `vite.config.ts`.

## Admin Route

- Set `VITE_HIDDEN_ADMIN_PATH` in `.env` for local frontend route; production builds read it from the build environment (or `.env` when present).
- Optional: set `VITE_API_PROXY_TARGET` in `.env` if Worker dev server is not on `http://127.0.0.1:8787`.
- Set `VITE_TURNSTILE_SITE_KEY` in `.env`; lookup and admin login now require Turnstile. Production builds read it from the build environment.
- Set `HIDDEN_ADMIN_PATH` in Worker env (`wrangler.jsonc`) or `.dev.vars` for backend route.
- `shared/admin-paths.ts` derives matching API paths from those env values.
- The admin path is obfuscation, not a secret: `VITE_*` values are inlined into the public JS bundle.
- Admin login returns a signed 12-hour session token; the password is only sent to the login endpoint.
- Removal request URLs use an unguessable public token, not the numeric row ID.
- Public navigation does not expose admin entry.

## Data at Rest

- E.164 values are encrypted with AES-GCM; the key is derived from `HASH_SECRET`.
- `phone_number_e164` is written as `NULL` for new rows. The daily cron encrypts legacy plaintext rows in batches of 100.
- Admin exports decrypt values in memory only.

## Abuse Controls

- All public writes and admin login are Turnstile-protected, bound to a Turnstile action, and checked against the request hostname.
- `wrangler.jsonc` defines a `RATE_LIMITER` binding (60 requests / 60 seconds per IP and scope). The Worker skips limiting when the binding is absent, so local dev and tests are unaffected.

## Local Dev

- Run `npm run dev:worker` in one terminal.
- Run `npm run dev` in another terminal.
- Keep `VITE_HIDDEN_ADMIN_PATH` and `HIDDEN_ADMIN_PATH` identical.
- Set `ENVIRONMENT=development` in `.dev.vars` when using Cloudflare test keys; Turnstile action/hostname checks are skipped in that mode.

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
- Set Worker secrets before first deploy with `npx wrangler secret put`:

```bash
npx wrangler login
npx wrangler secret put HASH_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put ADMIN_PASSWORD
```

- For a named Wrangler environment, add `--env <name>`:

```bash
npx wrangler secret put HASH_SECRET --env production
npx wrangler secret put TURNSTILE_SECRET_KEY --env production
npx wrangler secret put ADMIN_PASSWORD --env production
```

- `VITE_TURNSTILE_SITE_KEY` is public frontend config, not a Worker secret.
