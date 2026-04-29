const { verifyAccessToken } = require('../utils/jwtHelper');
const TokenModel = require('../models/TokenModel');

/**
 * Middleware JWT — dipakai di semua route terproteksi.
 * Cek: Bearer token ada, valid, dan tidak di-blacklist.
 */
async function jwtMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak disertakan' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Cek blacklist
    const blacklisted = await TokenModel.isBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({ success: false, message: 'Token sudah di-invalidate' });
    }

    // Verifikasi signature + expiry
    const decoded = verifyAccessToken(token);
    req.user  = decoded;   // { id, email, role, iat, exp }
    req.token = token;     // disimpan untuk keperluan logout
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token sudah kadaluarsa' });
    }
    return res.status(401).json({ success: false, message: 'Token tidak valid' });
  }
}

/**
 * Middleware otorisasi role — gunakan setelah jwtMiddleware
 * Contoh: authorize('admin')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: role tidak memiliki izin' });
    }
    next();
  };
}

module.exports = { jwtMiddleware, authorize };