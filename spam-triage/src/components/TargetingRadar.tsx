interface TargetingRadarProps {
  className?: string;
  size?: number;
}

export function TargetingRadar({
  className = "",
  size = 130,
}: TargetingRadarProps) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-full border border-cyan-500/30 bg-[#040814]/80 shadow-[0_0_20px_rgba(0,240,255,0.15)] ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Concentric Range Rings */}
      <div className="absolute inset-2 rounded-full border border-cyan-500/20" />
      <div className="absolute inset-7 rounded-full border border-cyan-500/25 border-dashed" />
      <div className="absolute inset-12 rounded-full border border-cyan-500/30" />

      {/* Crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-[1px] bg-cyan-500/20" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-full w-[1px] bg-cyan-500/20" />
      </div>

      {/* Rotating Radar Sweep Cone */}
      <div
        className="absolute inset-0 origin-center animate-[spin_4s_linear_infinite]"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, rgba(0, 240, 255, 0.4) 0deg, rgba(0, 240, 255, 0.05) 55deg, transparent 75deg, transparent 360deg)",
        }}
      />

      {/* Center Target Lock */}
      <div className="relative z-10 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />

      {/* Hostile Blip 1 */}
      <div className="absolute top-6 right-8 h-1.5 w-1.5 rounded-full bg-[#ff0055] shadow-[0_0_8px_#ff0055] animate-ping" />
      <div className="absolute top-6 right-8 h-1.5 w-1.5 rounded-full bg-[#ff0055]" />

      {/* Friendly Node Blip 2 */}
      <div className="absolute bottom-7 left-7 h-1 w-1 rounded-full bg-[#00ff9d] shadow-[0_0_6px_#00ff9d]" />

      {/* Radar Readout Tag */}
      <span className="absolute bottom-1 right-2 font-mono text-[8px] text-cyan-400/80 pointer-events-none">
        RADAR // 360°
      </span>
    </div>
  );
}
