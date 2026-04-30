const axios      = require('axios');
const OrderModel = require('../models/OrderModel');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://localhost:3002';

class OrderController {
  // ── POST /api/orders — checkout ────────────────────────────
  static async checkout(req, res) {
    const { event_id, items } = req.body;

    // Validasi input
    if (!event_id) {
      return res.status(422).json({ success: false, message: 'event_id wajib diisi' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'items wajib berupa array dan tidak boleh kosong',
      });
    }

    for (const item of items) {
      if (!item.ticket_category_id || !item.quantity || item.quantity < 1) {
        return res.status(422).json({
          success: false,
          message: 'Setiap item wajib memiliki ticket_category_id dan quantity ≥ 1',
        });
      }
    }

    try {
      // Ambil detail event + kategori tiket dari event-service
      let eventData;
      try {
        const eventResp = await axios.get(
          `${EVENT_SERVICE_URL}/api/events/${event_id}`,
          { headers: { Authorization: req.headers['authorization'] } }
        );
        eventData = eventResp.data.data;
      } catch (err) {
        if (err.response?.status === 404) {
          return res.status(404).json({ success: false, message: 'Event tidak ditemukan' });
        }
        throw err;
      }

      if (eventData.status !== 'published') {
        return res.status(422).json({ success: false, message: 'Event belum dipublikasikan' });
      }

      // Validasi setiap item terhadap kategori tiket event
      const enrichedItems = [];
      let totalAmount = 0;

      for (const item of items) {
        const category = eventData.ticket_categories.find(
          c => c.id === item.ticket_category_id
        );

        if (!category) {
          return res.status(404).json({
            success: false,
            message: `Kategori tiket ${item.ticket_category_id} tidak ditemukan di event ini`,
          });
        }

        const available = category.quota - category.sold;
        if (item.quantity > available) {
          return res.status(422).json({
            success: false,
            message: `Kuota tidak cukup untuk kategori "${category.name}". Tersedia: ${available}`,
          });
        }

        const subtotal = item.quantity * parseFloat(category.price);
        totalAmount += subtotal;

        enrichedItems.push({
          ticket_category_id:   category.id,
          ticket_category_name: category.name,
          quantity:             item.quantity,
          unit_price:           parseFloat(category.price),
          subtotal,
        });
      }

      // Order expired dalam 15 menit (bayar sebelum ini)
      const expiredAt = new Date(Date.now() + 15 * 60 * 1000);

      const orderId = await OrderModel.createWithItems({
        userId:      req.user.id,
        eventId:     event_id,
        items:       enrichedItems,
        totalAmount,
        expiredAt,
      });

      const order = await OrderModel.findById(orderId);

      return res.status(201).json({
        success: true,
        message: 'Order berhasil dibuat. Segera lakukan pembayaran dalam 15 menit.',
        data: {
          ...order,
          event_title:  eventData.title,
          event_date:   eventData.event_date,
          expired_at:   expiredAt,
        },
      });
    } catch (err) {
      console.error('[checkout]', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── POST /api/orders/:id/confirm — konfirmasi pembayaran ───
  static async confirmPayment(req, res) {
    const { id } = req.params;
    const { payment_method } = req.body;

    if (!payment_method) {
      return res.status(422).json({ success: false, message: 'payment_method wajib diisi' });
    }

    const allowedMethods = ['transfer', 'qris', 'virtual_account', 'cash'];
    if (!allowedMethods.includes(payment_method)) {
      return res.status(422).json({
        success: false,
        message: `payment_method tidak valid. Pilih: ${allowedMethods.join(', ')}`,
      });
    }

    try {
      const order = await OrderModel.findById(id);

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
      }

      // Hanya pemilik order yang bisa konfirmasi
      if (order.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
      }

      if (order.status !== 'pending') {
        return res.status(409).json({
          success: false,
          message: `Order tidak bisa dikonfirmasi. Status saat ini: ${order.status}`,
        });
      }

      // Cek apakah order sudah expired
      if (new Date(order.expired_at) < new Date()) {
        await OrderModel.updateStatus(id, 'cancelled');
        return res.status(422).json({
          success: false,
          message: 'Order sudah expired. Buat order baru.',
        });
      }

      // Update status order menjadi paid
      await OrderModel.updateStatus(id, 'paid', { payment_method });

      // Beri tahu event-service untuk membuat e-ticket
      // (inter-service call: payment-service → event-service)
      const ticketsCreated = [];

      for (const item of order.items) {
        try {
          const ticketResp = await axios.post(
            `${EVENT_SERVICE_URL}/api/tickets`,
            {
              ticket_category_id: item.ticket_category_id,
              owner_id:           order.user_id,
              order_id:           order.id,
              quantity:           item.quantity,
            },
            {
              headers: {
                Authorization:  req.headers['authorization'],
                'Content-Type': 'application/json',
              },
            }
          );
          ticketsCreated.push(...(ticketResp.data.data || []));
        } catch (ticketErr) {
          console.error('[confirmPayment] Gagal buat tiket:', ticketErr.message);
          // Tidak rollback order—tiket bisa dibuat ulang manual jika perlu
        }
      }

      const updatedOrder = await OrderModel.findById(id);

      return res.status(200).json({
        success: true,
        message: 'Pembayaran dikonfirmasi. E-ticket berhasil diterbitkan.',
        data: {
          order:   updatedOrder,
          tickets: ticketsCreated,
        },
      });
    } catch (err) {
      console.error('[confirmPayment]', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── GET /api/orders — listing order user ───────────────────
  static async index(req, res) {
    const page    = Math.max(parseInt(req.query.page    || 1), 1);
    const perPage = Math.min(Math.max(parseInt(req.query.per_page || 10), 1), 100);
    const status  = req.query.status || null;

    const validStatuses = ['pending', 'paid', 'cancelled', 'refunded'];
    if (status && !validStatuses.includes(status)) {
      return res.status(422).json({
        success: false,
        message: `status tidak valid. Pilih: ${validStatuses.join(', ')}`,
      });
    }

    try {
      const { data, total } = await OrderModel.findByUser(req.user.id, {
        page, perPage, status,
      });

      return res.status(200).json({
        success: true,
        data,
        meta: {
          current_page: page,
          per_page:     perPage,
          total,
          last_page:    Math.ceil(total / perPage),
        },
      });
    } catch (err) {
      console.error('[index]', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── GET /api/orders/:id — detail order ─────────────────────
  static async show(req, res) {
    try {
      const order = await OrderModel.findById(req.params.id);

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
      }

      if (order.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
      }

      return res.status(200).json({ success: true, data: order });
    } catch (err) {
      console.error('[show]', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── DELETE /api/orders/:id — batalkan order pending ────────
  static async cancel(req, res) {
    try {
      const order = await OrderModel.findById(req.params.id);

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
      }

      if (order.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
      }

      if (order.status !== 'pending') {
        return res.status(409).json({
          success: false,
          message: `Order tidak bisa dibatalkan. Status saat ini: ${order.status}`,
        });
      }

      await OrderModel.updateStatus(req.params.id, 'cancelled');

      return res.status(200).json({ success: true, message: 'Order berhasil dibatalkan' });
    } catch (err) {
      console.error('[cancel]', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

module.exports = OrderController;