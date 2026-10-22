import { useEffect, useState } from "react";

export function TerminalTicker() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        `${now.toISOString().slice(0, 10)} // ${now.toISOString().slice(11, 23)} UTC`,
      );
    };
    update();
    const interval = setInterval(update, 73);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full select-none overflow-hidden border-b border-cyan-500/15 bg-[#03080c] px-4 py-1 font-mono text-[10px] text-slate-400">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        {/* Live System Timestamp */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping bg-[#00ff88] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 bg-[#00ff88]" />
          </span>
          <span className="text-cyan-400 font-bold tracking-wider">
            SYS_CLOCK:
          </span>
          <span className="text-slate-300 tabular-nums">
            {time || "INITIALIZING..."}
          </span>
        </div>

        {/* Telemetry Stream Ticker */}
        <div className="hidden sm:flex items-center gap-4 overflow-hidden text-slate-500 text-[10px]">
          <span>
            CIPHER:{" "}
            <span className="text-slate-300">BLAKE3-WASM // SHA-256</span>
          </span>
          <span className="text-cyan-500/40">//</span>
          <span>
            SHIELD_HEALTH: <span className="text-[#00ff88]">100% ONLINE</span>
          </span>
          <span className="text-cyan-500/40">//</span>
          <span>
            ANOMALY_INDEX: <span className="text-cyan-300">0.038</span>
          </span>
          <span className="text-cyan-500/40">//</span>
          <span className="text-[#ff2a6d] font-bold animate-pulse">
            DEFENSE_MATRIX: ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}
