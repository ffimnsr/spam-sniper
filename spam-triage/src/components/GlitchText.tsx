import { useCallback, useEffect, useRef, useState } from "react";
import { soundFx } from "../lib/sound-fx.ts";

interface GlitchTextProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "span" | "p";
  scrambleOnHover?: boolean;
  chromatic?: boolean;
  autoGlitch?: boolean;
}

const GLITCH_CHARS = "01!@#$%^&*<>_/~{}[]ABCDEF0123456789";
const VARIANTS = ["glitching-v1", "glitching-v2", "glitching-v3"] as const;
type Variant = (typeof VARIANTS)[number];

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function GlitchText({
  text,
  className = "",
  as: Component = "span",
  scrambleOnHover = true,
  chromatic = true,
  autoGlitch = true,
}: GlitchTextProps) {
  const [displayChars, setDisplayChars] = useState<string[]>(() =>
    text.split(""),
  );
  const intervalRef = useRef<number | null>(null);
  const glitchTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const Tag = Component as React.ElementType;

  const fireGlitch = useCallback(() => {
    const element = rootRef.current;

    if (
      !element ||
      element.dataset.glitching === "true" ||
      prefersReducedMotion()
    ) {
      return;
    }

    const variant: Variant =
      VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
    element.dataset.glitching = "true";
    element.classList.add(variant);

    if (glitchTimerRef.current) {
      window.clearTimeout(glitchTimerRef.current);
    }

    glitchTimerRef.current = window.setTimeout(() => {
      element.classList.remove(...VARIANTS);
      element.dataset.glitching = "false";
      glitchTimerRef.current = null;
    }, 240);
  }, []);

  const startScramble = () => {
    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      setDisplayChars(
        text.split("").map((char, index) => {
          if (index < iteration) {
            return text[index];
          }
          if (char === " ") return " ";
          return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        }),
      );

      if (iteration >= text.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      iteration += 1 / 2;
    }, 28);
  };

  useEffect(() => {
    setDisplayChars(text.split(""));
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
      rootRef.current?.classList.remove(...VARIANTS);
    };
  }, [text]);

  useEffect(() => {
    if (!autoGlitch) {
      return;
    }

    const timers = new Set<number>();

    const later = (callback: () => void, delay: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        callback();
      }, delay);
      timers.add(id);
    };

    const schedule = () => {
      later(
        () => {
          fireGlitch();
          schedule();
        },
        Math.floor(Math.random() * 3000) + 2500,
      );
    };

    schedule();

    return () => {
      for (const id of timers) {
        window.clearTimeout(id);
      }
    };
  }, [autoGlitch, fireGlitch]);

  const handleMouseEnter = () => {
    if (scrambleOnHover) {
      soundFx.hover();
      startScramble();
    }
    fireGlitch();
  };

  // Group text into words so line wrapping happens strictly at whitespace boundaries
  const words = text.split(" ");
  let globalIndex = 0;

  return (
    <Tag
      ref={rootRef}
      data-text={text}
      aria-label={text}
      onMouseEnter={handleMouseEnter}
      className={`glitch-text glitch-title relative inline-block transition-colors select-none ${
        chromatic ? "glitch-chromatic" : ""
      } ${className}`}
    >
      {words.map((word, wordIdx) => {
        const wordChars = word.split("");
        const startIndex = globalIndex;
        // advance index by word length + 1 space
        globalIndex += wordChars.length + 1;
        const wordKey = `w-${wordIdx}-${word}`;

        return (
          <span key={wordKey} className="inline-block whitespace-nowrap">
            {wordChars.map((origChar, charIdx) => {
              const charIndex = startIndex + charIdx;
              const currentChar = displayChars[charIndex] ?? origChar;
              const charKey = `c-${charIndex}-${origChar}`;

              return (
                <span
                  key={charKey}
                  className="relative inline-block text-center"
                >
                  {/* Invisible anchor: locks the exact proportional width & height */}
                  <span
                    className="invisible pointer-events-none select-none"
                    aria-hidden="true"
                  >
                    {origChar}
                  </span>
                  {/* Display glitch character rendered strictly inside the locked slot */}
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                    {currentChar}
                  </span>
                </span>
              );
            })}
            {/* Standard breakable space between words */}
            {wordIdx < words.length - 1 && <span> </span>}
          </span>
        );
      })}
    </Tag>
  );
}
