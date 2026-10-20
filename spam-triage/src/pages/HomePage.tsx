import { Link } from "react-router-dom";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { GlitchText } from "../components/GlitchText.tsx";
import { TargetingRadar } from "../components/TargetingRadar.tsx";

export default function HomePage() {
  return (
    <div className="page-stack">
      {/* Hero Section */}
      <section className="page-hero">
        <div className="flex items-center justify-between">
          <p className="page-eyebrow">NEURAL DEFENSE // COMMUNITY INTAKE</p>
          <span className="font-mono text-xs text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-xs">
            SEC_LEVEL: ALPHA
          </span>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            {/* Stable container prevents any height variation or button jumping */}
            <div className="min-h-[4.5rem] sm:min-h-[5.5rem] flex items-center">
              <h1 className="page-title !mt-0">
                <GlitchText
                  text="CROWD SIGNALS FOR HOSTILE CALLS."
                  as="span"
                  chromatic={true}
                />
              </h1>
            </div>
            <p className="page-lede">
              Analyze incoming caller threat levels, broadcast decentralized
              spam signals, or challenge flagged numbers. All records stay
              privacy-first: one-way SHA-256 hashes, masked digits, zero user
              tracking.
            </p>
          </div>

          <div className="hidden md:flex flex-col items-center justify-center p-4 rounded-md border border-cyan-500/20 bg-[#070e1c]/60 backdrop-blur-md shadow-[0_0_25px_rgba(0,240,255,0.1)]">
            <TargetingRadar size={130} />
            <span className="font-mono text-[10px] text-cyan-400 mt-2 tracking-widest animate-pulse">
              [SYSTEM_LOCK: READY]
            </span>
          </div>
        </div>

        {/* Stable spacer between hero text and action buttons */}
        <div className="mt-8 pt-2 flex flex-wrap gap-4 border-t border-cyan-500/10">
          <Link to="/check">
            <Button variant="primary" className="!px-6 !py-3.5">
              Scan Target Number
            </Button>
          </Link>
          <Link to="/report">
            <Button variant="danger" className="!px-6 !py-3.5">
              Broadcast Threat Signal
            </Button>
          </Link>
          <Link to="/remove">
            <Button variant="secondary" className="!px-6 !py-3.5">
              Challenge / Request Removal
            </Button>
          </Link>
        </div>
      </section>

      {/* Info Cards Grid */}
      <section className="info-grid">
        <Card className="hover:border-cyan-400/50 transition-colors">
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="page-eyebrow">PROTOCOL 01</p>
              <span className="font-mono text-[10px] text-cyan-400">
                [CONFIDENCE_LADDER]
              </span>
            </div>
            <h2 className="text-xl font-bold font-orbitron text-white">
              <GlitchText text="Unique Node Verification." as="span" />
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Spam scores advance strictly through independent unique reporter
              nodes. Repeated reports from one source cannot artificially
              inflate threat level.
            </p>
          </CardBody>
        </Card>

        <Card className="hover:border-amber-400/50 transition-colors">
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="page-eyebrow">PROTOCOL 02</p>
              <span className="font-mono text-[10px] text-amber-400">
                [CONTEST_WINDOW]
              </span>
            </div>
            <h2 className="text-xl font-bold font-orbitron text-white">
              <GlitchText text="7-Day Public Challenge." as="span" />
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Removal requests remain open for a mandatory 7-day public
              challenge period. Uncontested numbers auto-resolve. Contested
              numbers escalate to operator review.
            </p>
          </CardBody>
        </Card>

        <Card className="hover:border-[#ff0055]/50 transition-colors">
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="page-eyebrow">PROTOCOL 03</p>
              <span className="font-mono text-[10px] text-[#ff0055]">
                [ZERO_FOOTPRINT]
              </span>
            </div>
            <h2 className="text-xl font-bold font-orbitron text-white">
              <GlitchText text="Zero User Tracking." as="span" />
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Search, report, or challenge numbers without registration or
              sign-in. All public telemetry displays masked strings and
              irreversible cryptographic digests.
            </p>
          </CardBody>
        </Card>
      </section>

      {/* Workflow Section */}
      <Card>
        <CardBody className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-3">
            <p className="page-eyebrow">OPERATIONAL SEQUENCE</p>
            <h2 className="text-2xl font-bold font-orbitron text-white tracking-wide">
              INTERCEPT FIRST. NEUTRALIZE NEXT.
            </h2>
            <p className="text-sm leading-relaxed text-slate-300 max-w-lg">
              Perform millisecond lookups across verified community spam hashes.
              If an unknown or malicious caller attacks, submit categorized
              telemetry to fortify defenses for the entire network.
            </p>
          </div>

          <div className="grid gap-3 font-mono text-xs text-slate-300">
            <div className="rounded-sm border border-cyan-500/20 bg-[#060b17] p-3.5 flex items-start gap-3">
              <span className="text-cyan-400 font-bold">01 //</span>
              <div>
                <p className="font-bold text-white">SCAN CALLER STATUS</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Verify threat tier, report velocity, and masked timeline.
                </p>
              </div>
            </div>

            <div className="rounded-sm border border-[#ff0055]/30 bg-[#060b17] p-3.5 flex items-start gap-3">
              <span className="text-[#ff0055] font-bold">02 //</span>
              <div>
                <p className="font-bold text-white">DISPATCH SPAM SIGNAL</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Categorize threat (phishing, loan spam, robocall,
                  impersonation).
                </p>
              </div>
            </div>

            <div className="rounded-sm border border-amber-500/25 bg-[#060b17] p-3.5 flex items-start gap-3">
              <span className="text-amber-400 font-bold">03 //</span>
              <div>
                <p className="font-bold text-white">CHALLENGE & REMOVE</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Transparent contest protocol prevents erroneous or malicious
                  flagging.
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
