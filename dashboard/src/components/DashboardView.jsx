import { useState, useEffect, useCallback } from 'react';
import { fetchStats, fetchScans, submitScan } from '../services/api';

// ── Small presentational pieces ──────────────────────────────────────────────

function VerdictPill({ verdict }) {
  const cls =
    verdict === 'Safe'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : 'bg-red-50 text-red-700 ring-red-600/20';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {verdict}
    </span>
  );
}

function StatCard({ label, value, valueClass }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-4xl font-bold tabular-nums ${valueClass}`}>
        {value ?? <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
    >
      <svg
        className="h-4 w-4 shrink-0 text-red-500"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0V8.75a.75.75 0 00-1.5 0v4.5zm.75-7a.75.75 0 110-1.5.75.75 0 010 1.5z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm font-medium text-red-700">{message}</p>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function DashboardView() {
  const [stats, setStats]       = useState(null);
  const [scans, setScans]       = useState([]);
  const [filter, setFilter]     = useState('');
  const [newUrl, setNewUrl]     = useState('');
  const [loading, setLoading]   = useState(true);  // true on first mount
  const [scanning, setScanning] = useState(false); // true during /api/scan POST
  const [error, setError]       = useState(null);  // banner message or null

  // Fetches /api/stats and /api/scans in parallel and updates state.
  // Any failure sets the error banner instead of crashing.
  const load = useCallback(async () => {
    setError(null);
    try {
      const [statsData, scansData] = await Promise.all([
        fetchStats(),
        fetchScans(),
      ]);
      setStats(statsData);
      setScans(scansData);
    } catch {
      setError("Couldn't reach the API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side filter — applied over the already-loaded scans array.
  // The backend already supports ?q= for large datasets (per CLAUDE.md §6),
  // but for typical usage the snappy local filter is preferred.
  const visibleScans = filter
    ? scans.filter((s) =>
        s.url.toLowerCase().includes(filter.toLowerCase()),
      )
    : scans;

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const url = newUrl.trim();
    if (!url) return;

    setScanning(true);
    setError(null);

    try {
      await submitScan(url);
      setNewUrl('');
      // Re-pull both endpoints so the table and stat cards reflect the new entry.
      await load();
    } catch {
      setError("Couldn't reach the API");
    } finally {
      setScanning(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    load();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">ScamSite Defender</h1>
            <p className="text-xs text-gray-400">Anti-quishing dashboard</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || scanning}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">

        {/* ── Error banner ── */}
        {error && <ErrorBanner message={error} />}

        {/* ── Summary cards ── */}
        <section aria-label="Summary statistics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Threats Blocked"
              value={stats?.malicious}
              valueClass="text-red-700"
            />
            <StatCard
              label="Safe Scans"
              value={stats?.safe}
              valueClass="text-emerald-700"
            />
            <StatCard
              label="Total Scans"
              value={stats?.total}
              valueClass="text-gray-900"
            />
          </div>
        </section>

        {/* ── Scan a new URL ── */}
        <section aria-label="Scan a new URL">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">
              Scan a new URL
            </h2>
            <form onSubmit={handleScanSubmit} className="flex gap-3">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com"
                required
                disabled={scanning}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="submit"
                disabled={scanning || loading}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning && (
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                )}
                {scanning ? 'Scanning…' : 'Scan'}
              </button>
            </form>
            {scanning && (
              <p className="mt-2 text-xs text-gray-400">
                VirusTotal analysis can take up to 60 seconds for new URLs…
              </p>
            )}
          </div>
        </section>

        {/* ── Scan history ── */}
        <section aria-label="Scan history">
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">

            {/* Table header + filter */}
            <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                Scan History
                {visibleScans.length > 0 && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                    {visibleScans.length}
                  </span>
                )}
              </h2>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by URL…"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-64"
              />
            </div>

            {/* Table body */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <svg
                  className="h-6 w-6 animate-spin text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span className="ml-3 text-sm text-gray-400">Loading…</span>
              </div>
            ) : visibleScans.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">
                {filter ? 'No URLs match your filter.' : 'No scans yet — submit a URL above to get started.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/60 text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="px-6 py-3 font-medium">URL</th>
                      <th className="px-6 py-3 font-medium">Scanned</th>
                      <th className="px-6 py-3 font-medium">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {visibleScans.map((scan) => (
                      <tr
                        key={scan._id}
                        className="transition-colors hover:bg-gray-50/50"
                      >
                        <td className="max-w-xs px-6 py-3">
                          <span
                            className="block truncate font-mono text-xs text-gray-700"
                            title={scan.url}
                          >
                            {scan.url}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-gray-400">
                          {new Date(scan.scannedAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-3">
                          <VerdictPill verdict={scan.verdict} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
