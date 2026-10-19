const axios = require('axios');

const VT_BASE = 'https://www.virustotal.com/api/v3';
const MAX_POLLS = 12;
const POLL_INTERVAL_MS = 5000;

// VT v3 URL identifier: base64url of the URL, no padding
function urlToVtId(url) {
  return Buffer.from(url)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function authHeaders() {
  return { 'x-apikey': process.env.VIRUSTOTAL_API_KEY };
}

// Map VT analysis stats to a binary verdict.
// Intentionally strict: any malicious flag → Malicious.
function verdictFromStats(stats) {
  return stats.malicious > 0 ? 'Malicious' : 'Safe';
}

function normalizeStats(raw) {
  return {
    malicious:  raw.malicious  ?? 0,
    suspicious: raw.suspicious ?? 0,
    harmless:   raw.harmless   ?? 0,
    undetected: raw.undetected ?? 0,
  };
}

// Step A: try to pull a cached report from VT (no quota cost).
// Returns { stats } on hit, null on miss, throws on unexpected errors.
async function fetchExistingReport(url) {
  try {
    const res = await axios.get(`${VT_BASE}/urls/${urlToVtId(url)}`, {
      headers: authHeaders(),
    });
    const raw = res.data.data.attributes.last_analysis_stats;
    return { stats: normalizeStats(raw) };
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

// Step B: submit the URL to VT for a fresh scan, then poll until done.
// Throws if the analysis does not complete within MAX_POLLS attempts.
async function submitAndPoll(url) {
  const params = new URLSearchParams();
  params.append('url', url);

  const submitRes = await axios.post(`${VT_BASE}/urls`, params, {
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const analysisId = submitRes.data.data.id;

  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const pollRes = await axios.get(`${VT_BASE}/analyses/${analysisId}`, {
      headers: authHeaders(),
    });

    const attrs = pollRes.data.data.attributes;
    if (attrs.status === 'completed') {
      return { stats: normalizeStats(attrs.stats) };
    }
  }

  // Do NOT fall back to Safe — surface as a hard error so the caller
  // treats this as a failure and the mobile client shows Error verdict.
  throw new Error(`VirusTotal analysis timed out after ${MAX_POLLS} polls`);
}

// Public entry point.  Always tries existing report first (zero quota cost),
// falls back to submit+poll only when VT has no prior record of the URL.
async function analyzeUrl(url) {
  const existing = await fetchExistingReport(url);
  const { stats } = existing ?? (await submitAndPoll(url));
  return { verdict: verdictFromStats(stats), stats };
}

module.exports = { analyzeUrl };
