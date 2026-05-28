import { useEffect, useRef } from "react";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          errorCallback?: () => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({ onVerify, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) {
      console.warn("VITE_TURNSTILE_SITE_KEY is not set");
      return;
    }

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => {
          onVerify(token);
        },
        errorCallback: () => {
          onError?.();
        },
        "expired-callback": () => {
          onVerify("");
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
  }, [onVerify, onError]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
