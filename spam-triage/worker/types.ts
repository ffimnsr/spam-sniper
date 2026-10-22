export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  HASH_SECRET: string;
  HASH_SECRET_PREVIOUS?: string;
  TURNSTILE_SECRET_KEY: string;
  HIDDEN_ADMIN_PATH: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ENVIRONMENT?: string;
  RATE_LIMITER?: RateLimitBinding;
  RATE_LIMITER_WRITE?: RateLimitBinding;
  RATE_LIMITER_READ?: RateLimitBinding;
}
