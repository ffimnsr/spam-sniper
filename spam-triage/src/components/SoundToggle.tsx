import { useEffect, useState } from "react";
import { soundFx } from "../lib/sound-fx.ts";

export function SoundToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(soundFx.isEnabled());
    return soundFx.subscribe((val) => setEnabled(val));
  }, []);

  const handleToggle = () => {
    soundFx.toggle();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      onMouseEnter={() => soundFx.hover()}
      title={enabled ? "Mute Cyber Audio FX" : "Enable Cyber Audio FX"}
      className={`group relative flex items-center gap-2 rounded-xs border px-2.5 py-1 font-mono text-xs transition-all duration-200 outline-none cursor-pointer ${
        enabled
          ? "border-cyan-400/80 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)]"
          : "border-slate-700 bg-[#060b17] text-slate-500 hover:border-slate-500 hover:text-slate-300"
      }`}
    >
      {/* Equalizer Audio Waves */}
      <div className="flex items-end gap-0.5 h-3">
        <span
          className={`w-0.5 rounded-xs transition-all ${
            enabled
              ? "bg-cyan-400 h-2.5 animate-[equalizer_0.8s_ease-in-out_infinite]"
              : "bg-slate-600 h-1"
          }`}
        />
        <span
          className={`w-0.5 rounded-xs transition-all ${
            enabled
              ? "bg-cyan-400 h-3 animate-[equalizer_0.6s_ease-in-out_infinite_0.2s]"
              : "bg-slate-600 h-2"
          }`}
        />
        <span
          className={`w-0.5 rounded-xs transition-all ${
            enabled
              ? "bg-[#ff0055] h-1.5 animate-[equalizer_0.7s_ease-in-out_infinite_0.4s]"
              : "bg-slate-600 h-1"
          }`}
        />
      </div>

      <span className="tracking-wider">
        AUDIO:{" "}
        <span className={enabled ? "font-bold text-white" : ""}>
          {enabled ? "ON" : "OFF"}
        </span>
      </span>
    </button>
  );
}
