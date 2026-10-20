interface CyberReticleProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export function CyberReticle({
  className = "w-7 h-7 text-cyan-400",
  size = 28,
  glow = true,
}: CyberReticleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${glow ? "drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" : ""}`}
    >
      {/* Outer segmented ring */}
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="6 4 12 4"
        className="opacity-70"
      />
      {/* Inner reticle ring */}
      <circle
        cx="24"
        cy="24"
        r="11"
        stroke="currentColor"
        strokeWidth="1.75"
        className="opacity-90"
      />
      {/* Center target dot */}
      <circle cx="24" cy="24" r="2.5" fill="currentColor" />
      {/* Precision crosshairs */}
      <line
        x1="24"
        y1="0"
        x2="24"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <line
        x1="24"
        y1="39"
        x2="24"
        y2="48"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <line
        x1="0"
        y1="24"
        x2="9"
        y2="24"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <line
        x1="39"
        y1="24"
        x2="48"
        y2="24"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Corner targeting notches */}
      <path
        d="M10 14L8 14L8 10L12 10L12 12"
        stroke="#ff0055"
        strokeWidth="1.5"
      />
      <path
        d="M38 14L40 14L40 10L36 10L36 12"
        stroke="#ff0055"
        strokeWidth="1.5"
      />
      <path
        d="M10 34L8 34L8 38L12 38L12 36"
        stroke="#ff0055"
        strokeWidth="1.5"
      />
      <path
        d="M38 34L40 34L40 38L36 38L36 36"
        stroke="#ff0055"
        strokeWidth="1.5"
      />
    </svg>
  );
}
