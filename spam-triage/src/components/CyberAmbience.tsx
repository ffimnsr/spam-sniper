import { useEffect, useState } from "react";

const STORAGE_KEY = "spam-sniper-glitch-enabled";

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function CyberAmbience() {
  const [enabled, setEnabled] = useState(
    () =>
      !prefersReducedMotion() && localStorage.getItem(STORAGE_KEY) !== "false",
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timers = new Set<number>();

    const later = (callback: () => void, delay: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        callback();
      }, delay);
      timers.add(id);
      return id;
    };

    const triggerBurst = () => {
      document.body.classList.add("screen-glitching");
      later(() => document.body.classList.remove("screen-glitching"), 180);

      const container = document.getElementById("glitch-slices");
      const slices: HTMLDivElement[] = [];

      if (container) {
        const count = Math.floor(Math.random() * 3) + 1;

        for (let index = 0; index < count; index += 1) {
          const slice = document.createElement("div");
          slice.className = "glitch-slice";
          slice.style.top = `${Math.floor(Math.random() * 88) + 4}%`;
          slice.style.height = `${Math.floor(Math.random() * 20) + 6}px`;
          slice.style.transform = `translateX(${(Math.random() - 0.5) * 16}px)`;

          if (Math.random() > 0.5) {
            slice.style.borderTopColor = "rgba(255, 42, 109, 0.8)";
            slice.style.borderBottomColor = "rgba(0, 240, 255, 0.8)";
          }

          container.appendChild(slice);
          slices.push(slice);
        }

        later(() => {
          for (const slice of slices) {
            slice.remove();
          }
        }, 240);
      }

      scheduleNext();
    };

    const scheduleNext = () => {
      later(triggerBurst, Math.floor(Math.random() * 6000) + 4000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        for (const id of timers) {
          window.clearTimeout(id);
        }
        timers.clear();
      } else {
        scheduleNext();
      }
    };

    scheduleNext();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.body.classList.remove("screen-glitching");

      for (const id of timers) {
        window.clearTimeout(id);
      }
    };
  }, [enabled]);

  const toggle = () => {
    setEnabled((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <>
      <div
        className={`cyber-overlay${enabled ? "" : " cyber-overlay-off"}`}
        aria-hidden="true"
      >
        <div className="crt-scanlines" />
        <div className="crt-beam" />
        <div className="glitch-watermark">SPAM_SNIPER</div>
        <div id="glitch-slices" className="glitch-slices" />
      </div>

      <button
        type="button"
        className={`fx-toggle${enabled ? " fx-toggle-on" : ""}`}
        onClick={toggle}
        aria-pressed={enabled}
      >
        FX: [{enabled ? "GLITCH_ON" : "GLITCH_OFF"}]
      </button>
    </>
  );
}
