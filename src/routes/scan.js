const express = require('express');
const router = express.Router();
const ScanLog = require('../models/ScanLog');
const { analyzeUrl } = require('../services/virusTotal');

// POST /api/scan
// 1. Return immediately if URL is already in the cache.
// 2. Otherwise call VirusTotal, persist the result, then respond.
// Never catches VirusTotal errors and silently returns Safe — any failure
// propagates to the global error handler (→ 500) so the client shows Error.
router.post('/scan', async (req, res, next) => {
  try {
    const url = (req.body.url ?? '').trim();
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    // Step 4: cache check (must happen before any VT call)
    const cached = await ScanLog.findOne({ url });
    if (cached) {
      return res.json({
        url:       cached.url,
        verdict:   cached.verdict,
        stats:     cached.stats,
        cached:    true,
        scannedAt: cached.scannedAt,
      });
    }

    // Step 5: VirusTotal analysis
    const { verdict, stats } = await analyzeUrl(url);

    // Step 6: persist
    const log = await ScanLog.create({ url, verdict, stats });

    // Step 7: respond
    res.status(201).json({
      url:       log.url,
      verdict:   log.verdict,
      stats:     log.stats,
      cached:    false,
      scannedAt: log.scannedAt,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/scans
// Supports ?q= (URL substring filter) and ?limit= (max rows, default 100).
router.get('/scans', async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    const filter = q ? { url: { $regex: q, $options: 'i' } } : {};
    const cap = Math.min(parseInt(limit, 10) || 100, 500);

    const scans = await ScanLog.find(filter)
      .sort({ scannedAt: -1 })
      .limit(cap)
      .select('-__v')
      .lean();

    res.json(scans);
  } catch (err) {
    next(err);
  }
});

// GET /api/stats
// Returns aggregate counts: total, malicious, safe.
router.get('/stats', async (req, res, next) => {
  try {
    const [total, malicious] = await Promise.all([
      ScanLog.countDocuments(),
      ScanLog.countDocuments({ verdict: 'Malicious' }),
    ]);

    res.json({ total, malicious, safe: total - malicious });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
