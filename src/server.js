require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const scanRouter = require('./routes/scan');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', scanRouter);

app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  // 1 = connected, anything else is degraded
  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? 'ok' : 'degraded',
    db:     ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown',
  });
});

// ── Global error handler ────────────────────────────────────────────────────
// Keeps error details out of the response in production.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error',
  });
});

// ── Startup ─────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;

mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, family: 4 })
  .then(() => {
    console.log('[db] MongoDB connected');
    app.listen(PORT, () => {
      console.log(`[server] Listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[db] Connection failed:', err.message);
    process.exit(1);
  });
