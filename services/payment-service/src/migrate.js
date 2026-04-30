const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  const db = process.env.DB_NAME || 'payment_db';
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\``);
  await conn.query(`USE \`${db}\``);

  // Tabel orders — satu order bisa berisi banyak item tiket
  await conn.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id            CHAR(36)      NOT NULL PRIMARY KEY,
      user_id       CHAR(36)      NOT NULL,
      event_id      CHAR(36)      NOT NULL,
      total_amount  DECIMAL(14,2) NOT NULL DEFAULT 0,
      status        ENUM('pending','paid','cancelled','refunded')
                                  NOT NULL DEFAULT 'pending',
      payment_method VARCHAR(50)  DEFAULT NULL,
      paid_at       DATETIME      DEFAULT NULL,
      expired_at    DATETIME      NOT NULL,
      created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Tabel order_items — detail tiket per kategori dalam satu order
  await conn.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id                  CHAR(36)      NOT NULL PRIMARY KEY,
      order_id            CHAR(36)      NOT NULL,
      ticket_category_id  CHAR(36)      NOT NULL,
      ticket_category_name VARCHAR(100) NOT NULL,
      quantity            INT           NOT NULL DEFAULT 1,
      unit_price          DECIMAL(12,2) NOT NULL,
      subtotal            DECIMAL(14,2) NOT NULL,
      created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.end();
  console.log(`Migrasi ${db} selesai: tabel orders, order_items terbuat`);
}

migrate().catch(err => {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
});