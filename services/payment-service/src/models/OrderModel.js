const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class OrderModel {
  // ── Order ─────────────────────────────────────────────────

  /**
   * Buat order baru beserta item-itemnya (dalam satu transaksi DB)
   */
  static async createWithItems({ userId, eventId, items, totalAmount, expiredAt }) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      const orderId = uuidv4();

      await conn.query(
        `INSERT INTO orders (id, user_id, event_id, total_amount, status, expired_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
        [orderId, userId, eventId, totalAmount, expiredAt]
      );

      for (const item of items) {
        await conn.query(
          `INSERT INTO order_items
            (id, order_id, ticket_category_id, ticket_category_name, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            orderId,
            item.ticket_category_id,
            item.ticket_category_name,
            item.quantity,
            item.unit_price,
            item.subtotal,
          ]
        );
      }

      await conn.commit();
      return orderId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Cari order berdasarkan id + eager load items
   */
  static async findById(id) {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!orders[0]) return null;

    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?', [id]
    );

    return { ...orders[0], items };
  }

  /**
   * Listing order milik user dengan paging
   */
  static async findByUser(userId, { page = 1, perPage = 10, status = null }) {
    const offset = (page - 1) * perPage;
    const params = [userId];
    let where = 'WHERE user_id = ?';

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    const [rows] = await pool.query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM orders ${where}`,
      params
    );

    return { data: rows, total: Number(total) };
  }

  /**
   * Update status order
   */
  static async updateStatus(id, status, extra = {}) {
    const fields = ['status = ?'];
    const values = [status];

    if (extra.payment_method) {
      fields.push('payment_method = ?');
      values.push(extra.payment_method);
    }

    if (status === 'paid') {
      fields.push('paid_at = NOW()');
    }

    values.push(id);
    await pool.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Batalkan semua order yang expired dan masih pending
   */
  static async expirePendingOrders() {
    const [result] = await pool.query(
      `UPDATE orders SET status = 'cancelled'
       WHERE status = 'pending' AND expired_at < NOW()`
    );
    return result.affectedRows;
  }
}

module.exports = OrderModel;