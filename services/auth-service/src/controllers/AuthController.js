const bcrypt    = require('bcryptjs');
const UserModel  = require('../models/UserModel');
const TokenModel = require('../models/TokenModel');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  tokenExpiresDate,
  REFRESH_EXP,
} = require('../utils/jwtHelper');

class AuthController {
  // ── POST /api/auth/register ─────────────────────────────────
  static async register(req, res) {
    const { name, email, password } = req.body;

    // Validasi input
    if (!name || !email || !password) {
      return res.status(422).json({ success: false, message: 'name, email, dan password wajib diisi' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(422).json({ success: false, message: 'Format email tidak valid' });
    }
    if (password.length < 8) {
      return res.status(422).json({ success: false, message: 'Password minimal 8 karakter' });
    }

    try {
      // Cek duplikat email
      const existing = await UserModel.findByEmail(email);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
      }

      const hashed = await bcrypt.hash(password, 12);
      const user   = await UserModel.create({ name, email, password: hashed });

      return res.status(201).json({
        success: true,
        message: 'Registrasi berhasil',
        data: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      console.error('[register]', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── POST /api/auth/login ────────────────────────────────────
  static async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({ success: false, message: 'email dan password wajib diisi' });
    }

    try {
      const user = await UserModel.findByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ success: false, message: 'Kredensial tidak valid' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Kredensial tidak valid' });
      }

      const payload = { id: user.id, email: user.email, role: user.role };

      const accessToken  = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);
      const refreshExp   = tokenExpiresDate(REFRESH_EXP);

      await TokenModel.saveRefreshToken(user.id, refreshToken, refreshExp);

      return res.status(200).json({
        success: true,
        message: 'Login berhasil',
        data: {
          access_token:  accessToken,
          refresh_token: refreshToken,
          token_type:    'Bearer',
          expires_in:    15 * 60, // detik
          user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
        },
      });
    } catch (err) {
      console.error('[login]', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── POST /api/auth/refresh ──────────────────────────────────
  static async refreshToken(req, res) {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(422).json({ success: false, message: 'refresh_token wajib diisi' });
    }

    try {
      // Verifikasi signature refresh token
      let decoded;
      try {
        decoded = verifyRefreshToken(refresh_token);
      } catch {
        return res.status(401).json({ success: false, message: 'Refresh token tidak valid atau kadaluarsa' });
      }

      // Pastikan ada di DB (belum dihapus / logout)
      const stored = await TokenModel.findRefreshToken(refresh_token);
      if (!stored) {
        return res.status(401).json({ success: false, message: 'Refresh token tidak dikenali' });
      }

      // Hapus token lama (rotation)
      await TokenModel.deleteRefreshToken(refresh_token);

      // Buat pasangan token baru
      const payload      = { id: decoded.id, email: decoded.email, role: decoded.role };
      const newAccess    = generateAccessToken(payload);
      const newRefresh   = generateRefreshToken(payload);
      const refreshExp   = tokenExpiresDate(REFRESH_EXP);

      await TokenModel.saveRefreshToken(decoded.id, newRefresh, refreshExp);

      return res.status(200).json({
        success: true,
        message: 'Token diperbarui',
        data: {
          access_token:  newAccess,
          refresh_token: newRefresh,
          token_type:    'Bearer',
          expires_in:    15 * 60,
        },
      });
    } catch (err) {
      console.error('[refreshToken]', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── POST /api/auth/logout ───────────────────────────────────
  static async logout(req, res) {
    // req.user dan req.token sudah diisi oleh jwtMiddleware
    const { refresh_token } = req.body;

    try {
      // Blacklist access token yang masih aktif
      const exp = new Date(req.user.exp * 1000);
      await TokenModel.blacklistToken(req.token, exp);

      // Hapus refresh token jika dikirim
      if (refresh_token) {
        await TokenModel.deleteRefreshToken(refresh_token);
      }

      return res.status(200).json({ success: true, message: 'Logout berhasil' });
    } catch (err) {
      console.error('[logout]', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── GET /api/auth/me ────────────────────────────────────────
  static async me(req, res) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
      return res.status(200).json({ success: true, data: user });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

module.exports = AuthController;