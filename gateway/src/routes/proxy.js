const express = require('express');
const proxy   = require('express-http-proxy');
const router  = express.Router();
const { authRateLimiter } = require('../middlewares/rateLimiter');
require('dotenv').config();

const AUTH_URL    = process.env.AUTH_SERVICE_URL    || 'http://localhost:3001';
const EVENT_URL   = process.env.EVENT_SERVICE_URL   || 'http://localhost:3002';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003';

/**
 * Opsi proxy default — teruskan semua header asli ke downstream service.
 * parseReqBody: false karena body sudah di-parse Express, biarkan stream diteruskan.
 */
const defaultProxyOpts = {
  parseReqBody: true,
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    // Teruskan IP klien asli ke downstream
    proxyReqOpts.headers['X-Forwarded-For'] =
      srcReq.headers['x-forwarded-for'] || srcReq.ip;
    proxyReqOpts.headers['X-Gateway-Version'] = '1.0';
    return proxyReqOpts;
  },
  userResDecorator(_proxyRes, proxyResData, _userReq, _userRes) {
    // Kembalikan response apa adanya dari downstream
    return proxyResData;
  },
  proxyErrorHandler(err, res, next) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'Service sedang tidak tersedia. Coba lagi nanti.',
      });
    }
    next(err);
  },
};

// ══════════════════════════════════════════════════════
// PETA ROUTING GATEWAY
// ──────────────────────────────────────────────────────
// Prefix masuk     → Service tujuan         → Path diteruskan
// /api/auth/*      → auth-service :3001     → /api/auth/*
// /api/events/*    → event-service :3002    → /api/events/*
// /api/tickets/*   → event-service :3002    → /api/tickets/*
// /api/orders/*    → payment-service :3003  → /api/orders/*
// ══════════════════════════════════════════════════════

// ── auth-service ───────────────────────────────────────
// Rate limiter ketat hanya untuk login & register
router.use('/api/auth/login',    authRateLimiter);
router.use('/api/auth/register', authRateLimiter);

router.use('/api/auth', proxy(AUTH_URL, {
  ...defaultProxyOpts,
  proxyReqPathResolver: (req) => '/api/auth' + req.url,
}));

// ── event-service ──────────────────────────────────────
router.use('/api/events', proxy(EVENT_URL, {
  ...defaultProxyOpts,
  proxyReqPathResolver: (req) => '/api/events' + req.url,
}));

router.use('/api/tickets', proxy(EVENT_URL, {
  ...defaultProxyOpts,
  proxyReqPathResolver: (req) => '/api/tickets' + req.url,
}));

// ── payment-service ────────────────────────────────────
router.use('/api/orders', proxy(PAYMENT_URL, {
  ...defaultProxyOpts,
  proxyReqPathResolver: (req) => '/api/orders' + req.url,
}));

module.exports = router;