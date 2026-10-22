# Contributing

## Scope

Keep changes focused on spam-call triage and the SpamSniper blocklist pipeline.

Before adding a stored field or a public endpoint, document:

- why the data is required;
- how long it is retained;
- how abuse is limited;
- whether the privacy policy needs an update.

## Local setup

Node 24 or newer is required because the test harness uses `node:sqlite`.

```sh
cd spam-triage
npm ci
cp .env.example .env
cp .dev.vars.example .dev.vars
```

Run the Worker and frontend in separate terminals:

```sh
npm run dev:worker
npm run dev
```

Keep `VITE_HIDDEN_ADMIN_PATH` and `HIDDEN_ADMIN_PATH` identical.

`ENVIRONMENT=development` bypasses the Cloudflare Access header check and Turnstile action/hostname checks only on local hostnames.

## Validation

Run all of these before opening a pull request:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests run against an in-memory SQLite database with every migration applied, so schema and trigger changes are exercised.

## Migrations

- Add a new numbered file under `spam-triage/migrations/`.
- Never edit an applied migration.
- Keep migrations safe for existing rows and add backfills where needed.
- Update tests that depend on schema behavior.

## Privacy and abuse rules

- Do not store raw phone numbers in plaintext.
- Do not expose full numbers, reporter hashes, or admin internals in public responses.
- Reporter identifiers are only for duplicate-report prevention, confidence counting, and abuse checks.
- Do not add analytics, ads, or behavioral tracking.
- Use Turnstile on public writes and Cloudflare Access on admin routes.
- Prefer bounded jobs and indexed queries for free-tier D1 usage.

## Admin access

The Worker does not implement passwords or session tokens. Protect both the hidden dashboard route and its `/api/...` path with a Cloudflare Access application. The Worker requires Access identity headers.
