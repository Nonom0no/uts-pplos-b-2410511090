const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  // Buat koneksi tanpa database dulu, agar bisa CREATE DATABASE
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  const db = process.env.DB_NAME || 'auth_db';
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\``);
  await conn.query(`USE \`${db}\``);

  // Tabel users
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           CHAR(36)     NOT NULL PRIMARY KEY,
      name         VARCHAR(100) NOT NULL,
      email        VARCHAR(150) NOT NULL UNIQUE,
      password     VARCHAR(255)          DEFAULT NULL,
      role         ENUM('user','admin')  NOT NULL DEFAULT 'user',
      oauth_provider VARCHAR(50)         DEFAULT NULL,
      oauth_id     VARCHAR(255)          DEFAULT NULL,
      avatar       TEXT                  DEFAULT NULL,
      created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Tabel refresh_tokens
  await conn.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         CHAR(36)     NOT NULL PRIMARY KEY,
      user_id    CHAR(36)     NOT NULL,
      token      TEXT         NOT NULL,
      expires_at DATETIME     NOT NULL,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Tabel token_blacklist (untuk logout / invalidate access token)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id         CHAR(36)  NOT NULL PRIMARY KEY,
      token      TEXT      NOT NULL,
      expires_at DATETIME  NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.end();
  console.log(`Migrasi ${db} selesai: tabel users, refresh_tokens, token_blacklist terbuat`);
}

migrate().catch(err => {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
});