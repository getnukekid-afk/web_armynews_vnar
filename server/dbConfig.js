// =============================================
// dbConfig.js – Cấu hình & Khởi tạo Database
// =============================================
// Dùng node:sqlite – module SQLite tích hợp sẵn trong Node.js v22+
// Không cần cài thêm package, không cần build tools
// API gần giống better-sqlite3 (synchronous)

require('dotenv').config();

// node:sqlite được tích hợp sẵn từ Node.js v22.5+
// Node v24 trở lên không cần flag --experimental-sqlite
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || './database.db';

// Mở kết nối đến file SQLite (tạo mới nếu chưa tồn tại)
const db = new DatabaseSync(DB_PATH);

// Bật WAL mode và foreign key constraints
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

/**
 * Khởi tạo schema và seed dữ liệu ban đầu.
 * Dùng CREATE TABLE IF NOT EXISTS nên an toàn khi chạy nhiều lần.
 */
function initDatabase() {
  // --- Bảng USERS ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      ip_address    TEXT    NOT NULL,
      is_verified   INTEGER DEFAULT 0,
      role          TEXT    DEFAULT 'reader',
      created_at    TEXT    DEFAULT (datetime('now'))
    )
  `);

  // --- Bảng EMAIL_TOKENS (token xác thực email 24h) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      token      TEXT    UNIQUE NOT NULL,
      expires_at TEXT    NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // --- Bảng CATEGORIES (danh mục tin tức) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL
    )
  `);

  // --- Bảng ARTICLES (bài báo) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      category_id  INTEGER,
      summary      TEXT,
      content      TEXT    NOT NULL,
      image_url    TEXT,
      author_id    INTEGER NOT NULL,
      status       TEXT    DEFAULT 'draft',
      published_at TEXT,
      created_at   TEXT    DEFAULT (datetime('now')),
      updated_at   TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (author_id)   REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // --- Seed danh mục mặc định nếu bảng trống ---
  const count = db.prepare('SELECT COUNT(*) as c FROM categories').get();
  if (count.c === 0) {
    const insertCat = db.prepare(
      'INSERT INTO categories (name, slug) VALUES (?, ?)'
    );
    const defaults = [
      ['Chính trị',  'chinh-tri'],
      ['Quân sự',    'quan-su'],
      ['Kinh tế',    'kinh-te'],
      ['Quốc tế',    'quoc-te'],
      ['Xã hội',     'xa-hoi'],
      ['Văn hóa',    'van-hoa'],
    ];
    defaults.forEach(([name, slug]) => insertCat.run(name, slug));
    console.log('[DB] Đã seed dữ liệu danh mục mặc định.');
  }

  console.log('[DB] Database khởi tạo thành công:', DB_PATH);
}

initDatabase();

module.exports = db;
