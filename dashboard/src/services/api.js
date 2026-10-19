const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function fetchStats() {
  const res = await fetch(`${BASE}/api/stats`);
  if (!res.ok) throw new Error(`stats ${res.status}`);
  return res.json();
}

export async function fetchScans({ q, limit } = {}) {
  const params = new URLSearchParams();
  if (q)     params.set('q', q);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetch(`${BASE}/api/scans${qs}`);
  if (!res.ok) throw new Error(`scans ${res.status}`);
  return res.json();
}

export async function submitScan(url) {
  const res = await fetch(`${BASE}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`scan ${res.status}`);
  return res.json();
}
