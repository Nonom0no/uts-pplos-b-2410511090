const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class TokenModel {
  // ── Refresh Token ─────────────────────────────────────────

  static async saveRefreshToken(userId, token, expiresAt) {
    const id = uuidv4();
    await pool.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [id, userId, token, expiresAt]
    );
    return id;
  }

  static async findRefreshToken(token) {
    const [rows] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [token]
    );
    return rows[0] || null;
  }

  static async deleteRefreshToken(token) {
    await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  }

  static async deleteRefreshTokensByUser(userId) {
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }

  // ── Blacklist (access token) ──────────────────────────────

  static async blacklistToken(token, expiresAt) {
    const id = uuidv4();
    await pool.query(
      'INSERT INTO token_blacklist (id, token, expires_at) VALUES (?, ?, ?)',
      [id, token, expiresAt]
    );
  }

  static async isBlacklisted(token) {
    const [rows] = await pool.query(
      'SELECT id FROM token_blacklist WHERE token = ?',
      [token]
    );
    return rows.length > 0;
  }

  // Bersihkan token kadaluarsa (opsional, bisa dijadwalkan)
  static async cleanExpired() {
    await pool.query('DELETE FROM token_blacklist WHERE expires_at < NOW()');
    await pool.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
  }
}

module.exports = TokenModel;