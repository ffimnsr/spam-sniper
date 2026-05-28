import { Link } from "react-router-dom";
import { Card, CardBody } from "../components/Card.tsx";

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <p className="page-eyebrow">Community Intake</p>
        <h1 className="page-title">Crowd signals for spam calls.</h1>
        <p className="page-lede">
          Check number history, submit spam reports, or request removal. Flow
          stays privacy-first: hashes only, masked displays, no accounts, no
          tracking.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/check" className="app-nav__link !px-5 !py-3">
            Check number
          </Link>
          <Link
            to="/report"
            className="inline-flex items-center rounded-full bg-gradient-to-b from-[#79bcff] to-[#2d89ff] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(45,137,255,0.24)] hover:translate-y-[-1px]"
          >
            Report caller
          </Link>
          <Link to="/remove" className="app-nav__link !px-5 !py-3">
            Request removal
          </Link>
        </div>
      </section>

      <section className="info-grid">
        <Card>
          <CardBody className="space-y-3">
            <p className="page-eyebrow">Signal Model</p>
            <h2 className="text-xl font-semibold text-slate-950">
              Confidence climbs with unique reporters.
            </h2>
            <p className="text-sm leading-7 text-slate-600">
              Multiple independent reports move number from pending to
              suspected, then verified spam.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-3">
            <p className="page-eyebrow">Removal Window</p>
            <h2 className="text-xl font-semibold text-slate-950">
              Seven-day contest period.
            </h2>
            <p className="text-sm leading-7 text-slate-600">
              Removal requests stay open for challenge. Uncontested requests
              auto-resolve. Contested requests move to review.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-3">
            <p className="page-eyebrow">Data Footprint</p>
            <h2 className="text-xl font-semibold text-slate-950">
              Your lookup stays private.
            </h2>
            <p className="text-sm leading-7 text-slate-600">
              Search, report, or request removal without creating account.
              Phone numbers stay masked on public pages.
            </p>
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardBody className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-3">
            <p className="page-eyebrow">Workflow</p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              Check first. Act next.
            </h2>
            <p className="text-sm leading-7 text-slate-600">
              Look up number in seconds. If record looks wrong, submit report or
              open removal request from same place.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-white/70 bg-white/60 px-4 py-3">
              1. Lookup number status and masked history.
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/60 px-4 py-3">
              2. Submit category-based spam signal.
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/60 px-4 py-3">
              3. Open or contest removal request when needed.
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
