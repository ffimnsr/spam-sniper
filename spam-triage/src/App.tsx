import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
            <Link to="/" className="text-xl font-semibold text-gray-900">
              Spam Triage
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link to="/check" className="text-gray-600 hover:text-gray-900">
                Check
              </Link>
              <Link to="/report" className="text-gray-600 hover:text-gray-900">
                Report
              </Link>
              <Link to="/remove" className="text-gray-600 hover:text-gray-900">
                Remove
              </Link>
              <Link to="/admin" className="text-gray-600 hover:text-gray-900">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl w-full px-4 py-8 flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/check" element={<CheckPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/remove" element={<RemovePage />} />
            <Route path="/removal/:id" element={<RemovalDetailPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" />} />
          </Routes>
        </main>
        <footer className="bg-white border-t">
          <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-gray-500 flex flex-col sm:flex-row sm:justify-between gap-2">
            <span>Privacy-first. No accounts, no tracking, no analytics.</span>
            <Link to="/admin" className="hover:text-gray-700">
              Admin
            </Link>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
