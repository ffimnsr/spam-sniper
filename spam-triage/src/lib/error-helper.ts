export interface ParsedError {
  code: string;
  message: string;
  suggestion?: string;
}

export function parseApiError(err: unknown): ParsedError {
  const raw = err instanceof Error ? err.message : String(err);

  // Match "[CODE]: [MESSAGE]" or "Error: [CODE]: [MESSAGE]"
  const match = raw.match(/(?:Error:\s*)?([A-Z_]+):\s*(.+)$/);
  const code = match ? match[1] : "SYSTEM_ALERT";
  const rawMsg = match ? match[2].trim() : raw.replace(/^Error:\s*/, "");

  switch (code) {
    case "INVALID_PHONE_NUMBER":
      return {
        code: "INVALID_PHONE_NUMBER",
        message:
          "The entered phone number is invalid for the selected country.",
        suggestion:
          "Check the country calling prefix and ensure the number contains valid national digits.",
      };
    case "TURNSTILE_FAILED":
      return {
        code: "TURNSTILE_FAILED",
        message: "Bot protection challenge verification failed or expired.",
        suggestion:
          "Please check the Turnstile verification box again before submitting.",
      };
    case "VALIDATION_ERROR":
      return {
        code: "VALIDATION_ERROR",
        message:
          rawMsg !== "VALIDATION_ERROR"
            ? rawMsg
            : "Form payload failed validation requirements.",
        suggestion: "Please verify all required fields are filled correctly.",
      };
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return {
        code,
        message: "Cloudflare Access authentication is required.",
        suggestion:
          "Authenticate through the Access policy for this hostname, then reload the page.",
      };
    case "INVALID_RESPONSE":
      return {
        code: "INVALID_RESPONSE",
        message: "The server returned an unexpected response.",
        suggestion:
          "If the admin console is behind Cloudflare Access, complete the Access login and reload.",
      };
    case "REMOVAL_COOLDOWN":
      return {
        code: "REMOVAL_COOLDOWN",
        message: "A recent removal request for this number was rejected.",
        suggestion:
          "Wait for the cooldown period before submitting another removal request.",
      };
    case "REMOVAL_RATE_LIMITED":
      return {
        code: "REMOVAL_RATE_LIMITED",
        message: "Too many removal requests from this reporter today.",
        suggestion: "Try again after the daily limit resets.",
      };
    case "NOT_FOUND":
      return {
        code: "NOT_FOUND",
        message: "Requested target or removal telemetry record was not found.",
        suggestion: "Verify the ID or search criteria and try again.",
      };
    case "ALREADY_REMOVED":
      return {
        code: "ALREADY_REMOVED",
        message: "Target number has already been cleared from the blocklist.",
      };
    case "DEADLINE_PASSED":
      return {
        code: "DEADLINE_PASSED",
        message: "The 7-day contest window has already elapsed.",
        suggestion: "This request has reached final disposition.",
      };
    case "ALREADY_CONTESTED":
      return {
        code: "ALREADY_CONTESTED",
        message:
          "You have already logged a contest challenge for this request.",
        suggestion:
          "Each reporter may only register one challenge per request.",
      };
    case "DUPLICATE_REMOVAL_REQUEST":
    case "REMOVAL_REQUEST_EXISTS":
      return {
        code,
        message: "An active removal request already exists for this number.",
        suggestion:
          "Check the removal status tracking page to follow the existing request.",
      };
    case "REMOVAL_UNDER_REVIEW":
      return {
        code,
        message: "This number is already under removal review.",
        suggestion:
          "Wait for the operator decision or use the existing tracking link.",
      };
    case "NUMBER_NOT_REPORTED":
      return {
        code,
        message: "This number has no community reports to remove.",
        suggestion:
          "Submit a spam report first if the number is actively calling.",
      };
    case "NOT_CONTESTABLE":
      return {
        code,
        message: "This removal request is no longer open for contest.",
        suggestion: "The challenge window has closed or a decision is pending.",
      };
    case "INVALID_STATE":
      return {
        code,
        message: rawMsg,
        suggestion: "Reload the queue and try again.",
      };
    case "RATE_LIMITED":
      return {
        code: "RATE_LIMITED",
        message: "Too many requests from this connection.",
        suggestion: "Wait a minute before trying again.",
      };
    case "PAYLOAD_TOO_LARGE":
      return {
        code: "PAYLOAD_TOO_LARGE",
        message: "Transmission payload exceeded maximum packet size (10KB).",
      };
    default:
      return {
        code: code || "TELEMETRY_ERROR",
        message: rawMsg || "An unexpected network or system anomaly occurred.",
        suggestion:
          "Verify your network connection and retry the transmission.",
      };
  }
}
