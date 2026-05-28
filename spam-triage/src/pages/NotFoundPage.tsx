import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="page-stack max-w-2xl">
      <section className="page-hero">
        <p className="page-eyebrow">Missing Page</p>
        <h1 className="page-title">Route not found.</h1>
        <p className="page-lede">
          Page does not exist or was moved outside public navigation.
        </p>
        <div className="mt-8">
          <Link to="/" className="app-nav__link !px-5 !py-3">
            Go home
          </Link>
        </div>
      </section>
    </div>
  );
}
