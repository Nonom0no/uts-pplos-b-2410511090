const rateLimit = require('express-rate-limit');
require('dotenv').config();

/**
 * Rate limiter global: 60 req/menit per IP (default)
 * Dipakai di seluruh gateway sebelum routing
 */
const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)       || 60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Terlalu banyak request. Batas: 60 request per menit per IP.',
  },
});

/**
 * Rate limiter ketat untuk endpoint auth (login/register)
 * Mencegah brute-force: 10 req/menit per IP
 */
const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login. Tunggu 1 menit.',
  },
});

module.exports = { globalRateLimiter, authRateLimiter };