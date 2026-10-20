// D1 surfaces constraint violations as messages. Keep the check in one place
// so route handlers do not each depend on the raw wording.
export function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE constraint failed");
}
