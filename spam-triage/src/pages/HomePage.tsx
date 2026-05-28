import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Community Spam Caller Triage
      </h2>
      <p className="text-gray-600 mb-4">
        This system lets the community report spam phone numbers. Multiple
        unique reports increase confidence that a number is spam.
      </p>
      <p className="text-gray-600 mb-4">
        Removal requests have a 7-day contest period. If nobody contests the
        request, the number is marked as removed.
      </p>
      <p className="text-gray-600 mb-6">
        We store only hashes and masked numbers. Raw phone numbers are never
        kept in plain text.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/check"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Check a Number
        </Link>
        <Link
          to="/report"
          className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Report a Number
        </Link>
        <Link
          to="/remove"
          className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
        >
          Request Removal
        </Link>
      </div>
      <div className="mt-8 text-sm text-gray-500">
        <p className="mb-2">
          This is a free-tier, open-source project. It intentionally avoids
          accounts, uploads, and tracking for MVP.
        </p>
        <p className="mb-2">
          Data collection is minimal. Abuse protection uses Cloudflare
          Turnstile.
        </p>
      </div>
    </div>
  );
}
