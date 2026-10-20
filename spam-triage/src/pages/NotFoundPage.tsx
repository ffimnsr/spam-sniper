import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button.tsx";
import { GlitchText } from "../components/GlitchText.tsx";
import { soundFx } from "../lib/sound-fx.ts";

export default function NotFoundPage() {
  useEffect(() => {
    soundFx.glitch();
  }, []);

  return (
    <div className="page-stack max-w-2xl mx-auto py-12">
      <section className="page-hero border-[#ff0055]/50 shadow-[0_0_35px_rgba(255,0,85,0.25)] relative overflow-hidden">
        {/* Anomaly static lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,85,0.03)_1px,transparent_1px)] bg-[size:100%_3px] pointer-events-none" />

        <div className="flex items-center justify-between">
          <p className="page-eyebrow text-[#ff0055]">
            [ANOMALY // 404_SECTOR_UNREACHABLE]
          </p>
          <span className="font-mono text-xs text-[#ff0055] bg-pink-950/40 border border-[#ff0055]/30 px-2 py-0.5 rounded-xs animate-pulse">
            SIGNAL_LOST
          </span>
        </div>

        <h1 className="page-title text-[#ff3377] mt-3">
          <GlitchText text="ROUTE NOT FOUND." as="span" chromatic={true} />
        </h1>

        <p className="page-lede text-slate-300">
          The requested coordinate does not exist in the active neural routing
          table or has been quarantined outside public navigational corridors.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/">
            <Button variant="primary" className="!px-6 !py-3">
              Return to Command Center
            </Button>
          </Link>
          <Link to="/check">
            <Button variant="secondary" className="!px-6 !py-3">
              Open Lookup Terminal
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
