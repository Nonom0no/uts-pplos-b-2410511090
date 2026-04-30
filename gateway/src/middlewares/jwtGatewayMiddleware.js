const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Daftar path yang TIDAK butuh JWT (public routes).
 * Pencocokan dilakukan terhadap path asli (sebelum proxy strip prefix).
 */
const PUBLIC_PATHS = [
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/refresh' },
  { method: 'GET',  path: '/api/auth/oauth/google' },
  { method: 'GET',  path: '/api/auth/oauth/google/callback' },
  { method: 'GET',  path: '/api/events' },         // listing publik
  { method: 'GET',  path: null, prefix: '/api/events/' }, // detail publik: /api/events/:id
  { method: 'GET',  path: null, prefix: '/health' },
];

function isPublic(req) {
  return PUBLIC_PATHS.some(rule => {
    if (rule.method !== req.method) return false;
    if (rule.path)   return req.path === rule.path;
    if (rule.prefix) return req.path.startsWith(rule.prefix);
    return false;
  });
}

/**
 * Middleware JWT di sisi Gateway.
 * Semua request ke protected route wajib lolos verifikasi di sini
 * sebelum diteruskan ke service downstream.
 */
function jwtGatewayMiddleware(req, res, next) {
  // Public routes — lewatkan tanpa cek token
  if (isPublic(req)) return next();

  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token tidak disertakan. Akses via Gateway wajib menyertakan Authorization header.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    // Token valid — lanjutkan ke proxy
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token sudah kadaluarsa' });
    }
    return res.status(401).json({ success: false, message: 'Token tidak valid' });
  }
}

module.exports = { jwtGatewayMiddleware };