import type { CSSProperties } from "react";

/**
 * Static, deterministic terminal chatter. Kept out of React state so the ambience
 * never triggers renders; the typing effect is pure CSS with stepped clip-path.
 */
const LEFT_LINES = [
  "> boot triage.shell --stream",
  "handshake: turnstile/ok",
  "hash: hmac-sha256 / aes-gcm",
  "lookup: keyed number hash",
  "reporter id: dedupe/abuse",
  "mask ledger: sync",
  "retention: bounded",
  "await next signal",
];

const RIGHT_LINES = [
  "> blocklist export: verified",
  "confidence: 3 unique nodes",
  "challenge window: 7d",
  "high confidence: operator review",
  "maintenance: staggered daily",
  "admin: cloudflare access",
  "reconcile: enabled",
  "> _",
];

const lineStyle = (index: number, text: string): CSSProperties =>
  ({
    animationDelay: `${-((index * 1.9) % 13)}s`,
    animationDuration: `${10 + (index % 5)}s`,
    "--line-length": text.length,
  }) as CSSProperties;

const ConsoleColumn = ({
  lines,
  side,
}: {
  lines: string[];
  side: "left" | "right";
}) => (
  <div className={`console-column console-column-${side}`}>
    {lines.map((line, index) => (
      <span
        key={`${side}-${line}`}
        className="console-line"
        style={lineStyle(index, line)}
      >
        {line}
      </span>
    ))}
  </div>
);

export function ConsoleAmbience() {
  return (
    <div className="console-ambience" aria-hidden="true">
      <ConsoleColumn lines={LEFT_LINES} side="left" />
      <ConsoleColumn lines={RIGHT_LINES} side="right" />
    </div>
  );
}
