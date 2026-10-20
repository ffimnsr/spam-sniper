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
      return {
        code: "UNAUTHORIZED",
        message: "Operator clearance denied. Access key rejected.",
        suggestion: "Ensure your secret operator passkey is correct.",
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
    case "REMOVAL_REQUEST_EXISTS":
      return {
        code: "REMOVAL_REQUEST_EXISTS",
        message: "An active removal request already exists for this number.",
        suggestion:
          "Check the removal status tracking page to follow the existing request.",
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
