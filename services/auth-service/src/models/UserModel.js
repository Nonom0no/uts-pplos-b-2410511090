const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class UserModel {
  /**
   * Buat user baru
   */
  static async create({ name, email, password = null, role = 'user', oauth_provider = null, oauth_id = null, avatar = null }) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO users (id, name, email, password, role, oauth_provider, oauth_id, avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email, password, role, oauth_provider, oauth_id, avatar]
    );
    return { id, name, email, role, oauth_provider, oauth_id, avatar };
  }

  /**
   * Cari user berdasarkan email
   */
  static async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }

  /**
   * Cari user berdasarkan id
   */
  static async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, oauth_provider, avatar, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Cari user berdasarkan oauth_provider + oauth_id
   */
  static async findByOAuth(provider, oauthId) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?',
      [provider, oauthId]
    );
    return rows[0] || null;
  }

  /**
   * Update avatar / name
   */
  static async updateProfile(id, { name, avatar }) {
    await pool.query(
      'UPDATE users SET name = ?, avatar = ? WHERE id = ?',
      [name, avatar, id]
    );
  }

  static async linkOAuth(id, provider, oauthId, avatar) {
    await pool.query(
      'UPDATE users SET oauth_provider = ?, oauth_id = ?, avatar = ? WHERE id = ?',
      [provider, oauthId, avatar, id]
    );
  }
}

module.exports = UserModel;