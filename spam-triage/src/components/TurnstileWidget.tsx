import { useEffect, useRef, useState } from "react";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  resetKey?: number | string;
  action?: string;
  className?: string;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: string | HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          callback: (token: string) => void;
          errorCallback?: () => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({
  onVerify,
  onError,
  resetKey,
  action,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Callbacks are usually inline arrow functions. Keep them in refs so the
  // widget effect depends only on resetKey/action instead of re-rendering on
  // every parent render.
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
  }, [onVerify, onError]);

  useEffect(() => {
    // Read resetKey to trigger re-render on challenge reset
    if (resetKey !== undefined) {
      setIsVerified(false);
    }

    if (!SITE_KEY) {
      console.warn("VITE_TURNSTILE_SITE_KEY is not set");
      return;
    }

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;

      // Clean up previous widget if any
      if (widgetIdRef.current) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // ignore
        }
      }

      containerRef.current.innerHTML = "";
      setIsVerified(false);

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        action,
        theme: "dark",
        callback: (token: string) => {
          setIsVerified(true);
          onVerifyRef.current(token);
        },
        errorCallback: () => {
          setIsVerified(false);
          onErrorRef.current?.();
        },
        "expired-callback": () => {
          setIsVerified(false);
          onVerifyRef.current("");
        },
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.body.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [resetKey, action]);

  return (
    <div className={`cyber-inset p-2.5 ${className ?? ""}`}>
      <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-cyan-400">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 ${isVerified ? "bg-[#00ff88] shadow-[0_0_8px_#00ff88]" : "bg-amber-400 animate-pulse"}`}
          />
          // CYBER_DEFENSE_GATEWAY
        </span>
        <span className="text-slate-500">
          {isVerified ? "[AUTHENTICATED]" : "[VERIFICATION_REQUIRED]"}
        </span>
      </div>

      <div
        ref={containerRef}
        className="min-h-[65px] flex items-center justify-center overflow-hidden"
      />

      {!SITE_KEY && (
        <div className="mt-2 text-center font-mono text-xs text-amber-400">
          Turnstile sitekey unconfigured in environment.
        </div>
      )}
    </div>
  );
}
