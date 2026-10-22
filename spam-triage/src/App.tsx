import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";
import { ConsoleAmbience } from "./components/ConsoleAmbience.tsx";
import { CyberAmbience } from "./components/CyberAmbience.tsx";
import { CyberReticle } from "./components/CyberReticle.tsx";
import { SoundToggle } from "./components/SoundToggle.tsx";
import { TerminalTicker } from "./components/TerminalTicker.tsx";
import { hiddenAdminRoute } from "./lib/admin-path.ts";
import { soundFx } from "./lib/sound-fx.ts";
import AdminPage from "./pages/AdminPage.tsx";
import CheckPage from "./pages/CheckPage.tsx";
import HomePage from "./pages/HomePage.tsx";
import NotFoundPage from "./pages/NotFoundPage.tsx";
import RemovalDetailPage from "./pages/RemovalDetailPage.tsx";
import RemovePage from "./pages/RemovePage.tsx";
import ReportPage from "./pages/ReportPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <div className="hazard-stripe" />
      <ConsoleAmbience />
      <CyberAmbience />

      <div className="app-shell">
        {/* Live System Timestamp & Telemetry Banner */}
        <TerminalTicker />

        {/* Top HUD Bar */}
        <header className="app-topbar">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link
              to="/"
              className="app-brand group"
              onMouseEnter={() => soundFx.hover()}
            >
              <div className="relative flex items-center justify-center border border-cyan-500/30 bg-[var(--cp-surface)] p-2 transition-all group-hover:border-cyan-400 group-hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]">
                <CyberReticle size={26} className="text-cyan-400" />
              </div>
              <div className="app-brand__text">
                <span className="app-brand__eyebrow">
                  NEURAL DEFENSE // PROTOCOL
                </span>
                <span className="app-brand__name">
                  SPAM<span className="text-cyan-400">SNIPER</span>
                </span>
              </div>
            </Link>

            {/* Audio Toggle & Quick Status */}
            <div className="flex items-center gap-3">
              <SoundToggle />

              {/* Navigation Tabs */}
              <nav className="app-nav">
                <NavLink
                  to="/check"
                  onMouseEnter={() => soundFx.hover()}
                  className={({ isActive }) =>
                    `app-nav__link ${isActive ? "active" : ""}`
                  }
                >
                  [ Check ]
                </NavLink>
                <NavLink
                  to="/report"
                  onMouseEnter={() => soundFx.hover()}
                  className={({ isActive }) =>
                    `app-nav__link ${isActive ? "active" : ""}`
                  }
                >
                  [ Report ]
                </NavLink>
                <NavLink
                  to="/remove"
                  onMouseEnter={() => soundFx.hover()}
                  className={({ isActive }) =>
                    `app-nav__link ${isActive ? "active" : ""}`
                  }
                >
                  [ Remove ]
                </NavLink>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          <section className="app-panel">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/check" element={<CheckPage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/remove" element={<RemovePage />} />
              <Route path="/removal/:token" element={<RemovalDetailPage />} />
              <Route path={hiddenAdminRoute} element={<AdminPage />} />
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" />} />
            </Routes>
          </section>
        </main>

        {/* Cyberpunk Tactical Footer */}
        <footer className="app-footer">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 font-mono text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wider text-slate-200">
                  SPAM SNIPER // TRIAGE
                </span>
                <span className="border border-cyan-500/30 px-1 text-[10px] text-cyan-400">
                  v2.4.0-CYBER
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Cryptographic zero-knowledge lookup. No accounts, no IP
                tracking, no persistent telemetry.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <Link
                to="/check"
                onMouseEnter={() => soundFx.hover()}
                className="text-slate-400 hover:text-cyan-300 transition-colors"
              >
                // SCAN_TARGET
              </Link>
              <Link
                to="/report"
                onMouseEnter={() => soundFx.hover()}
                className="text-slate-400 hover:text-pink-400 transition-colors"
              >
                // TRANSMIT_SIGNAL
              </Link>
              <Link
                to="/remove"
                onMouseEnter={() => soundFx.hover()}
                className="text-slate-400 hover:text-amber-300 transition-colors"
              >
                // CONTEST_RECORD
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
