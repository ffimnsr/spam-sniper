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

- Set `VITE_HIDDEN_ADMIN_PATH` in `.env` for frontend route.
- Optional: set `VITE_API_PROXY_TARGET` in `.env` if Worker dev server is not on `http://127.0.0.1:8787`.
- Set `HIDDEN_ADMIN_PATH` in Worker env or `.dev.vars` for backend route.
- `shared/admin-paths.ts` derives matching API paths from those env values.
- Public navigation does not expose admin entry.

## Local Dev

- Run `npm run dev:worker` in one terminal.
- Run `npm run dev` in another terminal.
- Keep `VITE_HIDDEN_ADMIN_PATH` and `HIDDEN_ADMIN_PATH` identical.

## Deploy

- Run `npm run deploy` for default environment.
- Run `npm run deploy -- --env <name>` for named Wrangler environment.
- Run `npm run deploy -- --skip-migrations` only if remote schema already current.
- Set Worker secrets before first deploy: `HASH_SECRET`, `TURNSTILE_SECRET_KEY`, `ADMIN_PASSWORD`.
