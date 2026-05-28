import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { hiddenAdminRoute } from "./lib/admin-path.ts";
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
      <div className="app-shell">
        <div className="app-shell__glow app-shell__glow--left" />
        <div className="app-shell__glow app-shell__glow--right" />
        <header className="app-topbar">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <Link to="/" className="app-brand">
              <span className="app-brand__eyebrow">Community Shield</span>
              <span className="app-brand__name">Spam Sniper</span>
            </Link>
            <nav className="app-nav">
              <Link to="/check" className="app-nav__link">
                Check
              </Link>
              <Link to="/report" className="app-nav__link">
                Report
              </Link>
              <Link to="/remove" className="app-nav__link">
                Remove
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-8">
          <section className="app-panel">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/check" element={<CheckPage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/remove" element={<RemovePage />} />
              <Route path="/removal/:id" element={<RemovalDetailPage />} />
              <Route path={hiddenAdminRoute} element={<AdminPage />} />
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" />} />
            </Routes>
          </section>
        </main>
        <footer className="app-footer">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-semibold text-slate-900">Spam Sniper</span>
              <span className="ml-2">
                Privacy-first. No accounts, no tracking, no analytics.
              </span>
            </div>
            <div className="flex gap-4">
              <Link to="/check" className="hover:text-slate-900">
                Lookup
              </Link>
              <Link to="/report" className="hover:text-slate-900">
                Reports
              </Link>
              <Link to="/remove" className="hover:text-slate-900">
                Removal
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
