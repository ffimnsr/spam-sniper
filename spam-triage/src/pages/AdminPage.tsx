import { useState } from "react";
import {
  type AdminRemovalRequest,
  type AdminSummary,
  getAdminRemovalRequests,
  getAdminSummary,
  resolveAdminRemovalRequest,
} from "../api/admin.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { Input } from "../components/Input.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [requests, setRequests] = useState<AdminRemovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async (pwd: string) => {
    setLoading(true);
    setError("");
    try {
      const [sumRes, reqRes] = await Promise.all([
        getAdminSummary(pwd),
        getAdminRemovalRequests(pwd),
      ]);
      setSummary(sumRes);
      setRequests(reqRes.requests);
      setAuthenticated(true);
    } catch (e) {
      setError(String(e));
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchData(password);
  };

  const handleResolve = async (
    id: number,
    action: "approve_removal" | "reject_removal" | "mark_disputed",
  ) => {
    try {
      await resolveAdminRemovalRequest(id, { action }, password);
      await fetchData(password);
    } catch (e) {
      setError(String(e));
    }
  };

  if (!authenticated) {
    return (
      <div className="max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Access</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
          />
          <Button type="submit" loading={loading}>
            Login
          </Button>
        </form>
        {error && <p className="mt-4 text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Admin Dashboard</h2>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Total Numbers</p>
              <p className="text-2xl font-bold">{summary.totalNumbers}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold">{summary.pending}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Suspected</p>
              <p className="text-2xl font-bold">{summary.suspected}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Verified Spam</p>
              <p className="text-2xl font-bold">{summary.verifiedSpam}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Under Review</p>
              <p className="text-2xl font-bold">{summary.underRemovalReview}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Disputed</p>
              <p className="text-2xl font-bold">{summary.disputed}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Removed</p>
              <p className="text-2xl font-bold">{summary.removed}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">Open Requests</p>
              <p className="text-2xl font-bold">
                {summary.openRemovalRequests}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900">
        Removal Requests (Open / Contested)
      </h3>
      {requests.length === 0 ? (
        <p className="text-gray-600">No open or contested requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardBody>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{req.display_mask}</span>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-sm text-gray-600">
                  Reason: {req.reason} · Contests: {req.contest_count} ·
                  Deadline:{" "}
                  {new Date(req.contest_deadline).toLocaleDateString()}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => handleResolve(req.id, "approve_removal")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleResolve(req.id, "reject_removal")}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleResolve(req.id, "mark_disputed")}
                  >
                    Mark Disputed
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
