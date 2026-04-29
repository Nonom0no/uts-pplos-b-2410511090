const axios     = require('axios');
const UserModel  = require('../models/UserModel');
const TokenModel = require('../models/TokenModel');
const {
  generateAccessToken,
  generateRefreshToken,
  tokenExpiresDate,
  REFRESH_EXP,
} = require('../utils/jwtHelper');
require('dotenv').config();

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USER_URL  = 'https://www.googleapis.com/oauth2/v3/userinfo';

class OAuthController {
  /**
   * GET /api/auth/oauth/google
   * Redirect browser ke halaman consent Google
   */
  static redirectToGoogle(_req, res) {
    const params = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope:         'openid email profile',
      access_type:   'offline',
      prompt:        'select_account',
    });
    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  }

  /**
   * GET /api/auth/oauth/google/callback
   * Google redirect ke sini dengan ?code=...
   * Authorization Code Flow (bukan Implicit)
   */
  static async handleGoogleCallback(req, res) {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code tidak diterima dari Google' });
    }

    try {
      // 1. Tukar code → access_token Google
      const tokenResp = await axios.post(GOOGLE_TOKEN_URL, {
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
        grant_type:    'authorization_code',
      });

      const googleAccessToken = tokenResp.data.access_token;

      // 2. Ambil profil user dari Google
      const profileResp = await axios.get(GOOGLE_USER_URL, {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });

      const { sub: googleId, email, name, picture } = profileResp.data;

      // 3. Cari / buat user lokal
      let user = await UserModel.findByOAuth('google', googleId);

      if (!user) {
        // Cek apakah email sudah ada (user pernah daftar manual)
        user = await UserModel.findByEmail(email);

        if (user) {
          // Hubungkan akun OAuth ke user yang sudah ada
          // (update oauth_provider dan oauth_id)
          await UserModel.linkOAuth(user.id, 'google', googleId, picture);
          user = await UserModel.findById(user.id);
        } else {
          // Buat user baru dengan flag oauth_provider
          user = await UserModel.create({
            name,
            email,
            oauth_provider: 'google',
            oauth_id:       googleId,
            avatar:         picture,
          });
        }
      } else {
        // Update avatar jika berubah
        await UserModel.updateProfile(user.id, { name: user.name, avatar: picture });
      }

      // 4. Generate JWT lokal (sama seperti login biasa)
      const payload = { id: user.id, email: user.email, role: user.role };

      const accessToken  = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);
      const refreshExp   = tokenExpiresDate(REFRESH_EXP);

      await TokenModel.saveRefreshToken(user.id, refreshToken, refreshExp);

      // 5. Kirim token ke klien
      //    Untuk SPA: kembalikan JSON; untuk web biasa: redirect + set cookie
      return res.status(200).json({
        success: true,
        message: 'Login Google berhasil',
        data: {
          access_token:  accessToken,
          refresh_token: refreshToken,
          token_type:    'Bearer',
          expires_in:    15 * 60,
          user: {
            id:             user.id,
            name:           user.name || name,
            email:          user.email,
            role:           user.role,
            avatar:         picture,
            oauth_provider: 'google',
          },
        },
      });
    } catch (err) {
      console.error('[OAuthController.handleGoogleCallback]', err.response?.data || err.message);
      return res.status(500).json({ success: false, message: 'Gagal memproses login Google' });
    }
  }
}

module.exports = OAuthController;