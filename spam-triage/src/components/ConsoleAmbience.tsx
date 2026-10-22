import type { CSSProperties } from "react";

/**
 * Static, deterministic terminal chatter. Kept out of React state so the ambience
 * never triggers renders; the typing effect is pure CSS with stepped clip-path.
 */
const LEFT_LINES = [
  "> boot triage.shell --stream",
  "handshake: turnstile/ok",
  "cipher: blake3-wasm / sha256",
  "scan 128 caller hashes",
  "community nodes: 42",
  "mask ledger: sync",
  "shield health 100%",
  "await next signal",
];

const RIGHT_LINES = [
  "> blocklist.db sync",
  "verified targets: 312",
  "risk: 1 signal per node",
  "confidence ladder: armed",
  "contest window: 7d",
  "defense matrix active",
  "anomaly index: 0.038",
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
