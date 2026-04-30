const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware JWT untuk payment-service.
 * Hanya memverifikasi token yang diterbitkan oleh auth-service
 * menggunakan JWT_SECRET yang sama.
 */
async function jwtMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak disertakan' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user  = decoded;  // { id, email, role, iat, exp }
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token sudah kadaluarsa' });
    }
    return res.status(401).json({ success: false, message: 'Token tidak valid' });
  }
}

module.exports = { jwtMiddleware };