import type { Env } from "../types.ts";

const REQUIRED_KEYS = [
  "DB",
  "ASSETS",
  "HASH_SECRET",
  "TURNSTILE_SECRET_KEY",
  "ADMIN_PASSWORD",
  "HIDDEN_ADMIN_PATH",
] as const;

// Returns names only. Never log or return secret values.
export function findMissingEnv(env: Env): string[] {
  return REQUIRED_KEYS.filter((key) => !env[key]);
}
