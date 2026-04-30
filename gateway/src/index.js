require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const { globalRateLimiter }    = require('./middlewares/rateLimiter');
const { jwtGatewayMiddleware } = require('./middlewares/jwtGatewayMiddleware');
const proxyRoutes              = require('./routes/proxy');

const app  = express();
const PORT = process.env.PORT || 8000;

// ── Middleware global ──────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Rate limiter global (60 req/menit per IP)
app.use(globalRateLimiter);

// 2. JWT validation di sisi gateway (sebelum diteruskan)
app.use(jwtGatewayMiddleware);

// 3. Proxy routing ke downstream services
app.use(proxyRoutes);

// Health check gateway sendiri
app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'api-gateway',
    port: PORT,
    routing: {
      '/api/auth/*':    process.env.AUTH_SERVICE_URL,
      '/api/events/*':  process.env.EVENT_SERVICE_URL,
      '/api/tickets/*': process.env.EVENT_SERVICE_URL,
      '/api/orders/*':  process.env.PAYMENT_SERVICE_URL,
    },
  })
);

// 404 handler
app.use((_req, res) =>
  res.status(404).json({ success: false, message: 'Route tidak ditemukan di Gateway' })
);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Gateway Error]', err.message);
  res.status(500).json({ success: false, message: 'Internal gateway error' });
});

// ── Start ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`API Gateway listening on http://localhost:${PORT}`);
  console.log('Routing:');
  console.log(`  /api/auth/*    → ${process.env.AUTH_SERVICE_URL}`);
  console.log(`  /api/events/*  → ${process.env.EVENT_SERVICE_URL}`);
  console.log(`  /api/tickets/* → ${process.env.EVENT_SERVICE_URL}`);
  console.log(`  /api/orders/*  → ${process.env.PAYMENT_SERVICE_URL}`);
});