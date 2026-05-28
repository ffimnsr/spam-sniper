export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  HASH_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  ADMIN_PASSWORD: string;
  HIDDEN_ADMIN_PATH: string;
}
