import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Page Not Found</h2>
      <p className="text-gray-600 mb-4">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Go Home
      </Link>
    </div>
  );
}
