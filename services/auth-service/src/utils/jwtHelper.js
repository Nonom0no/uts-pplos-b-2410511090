const jwt = require('jsonwebtoken');
require('dotenv').config();

const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_EXP     = process.env.JWT_EXPIRES_IN         || '15m';
const REFRESH_EXP    = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * Generate access token (≤15 menit)
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXP });
}

/**
 * Generate refresh token (≤7 hari)
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

/**
 * Verifikasi access token → return decoded payload atau throw
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verifikasi refresh token → return decoded payload atau throw
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

/**
 * Hitung tanggal expired dari token (untuk disimpan di DB)
 */
function tokenExpiresDate(expiresIn) {
  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  const match = String(expiresIn).match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Format expiresIn tidak valid');
  const seconds = parseInt(match[1]) * units[match[2]];
  return new Date(Date.now() + seconds * 1000);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  tokenExpiresDate,
  REFRESH_EXP,
};