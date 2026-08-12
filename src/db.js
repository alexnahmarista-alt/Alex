const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'castillos.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const DEFAULT_PRODUCTS = [
  { id: 'p1', name: 'Camarón grande', unit: 'kg', price: 320, icon: '🦐' },
  { id: 'p2', name: 'Pulpo entero', unit: 'kg', price: 280, icon: '🐙' },
  { id: 'p3', name: 'Colas de langosta', unit: 'kg', price: 850, icon: '🦞' },
  { id: 'p4', name: 'Filete de pescado canané', unit: 'kg', price: 190, icon: '🐟' },
  { id: 'p5', name: 'Jaiba / cangrejo', unit: 'kg', price: 240, icon: '🦀' },
  { id: 'p6', name: 'Pulpo baby', unit: 'kg', price: 310, icon: '🐙' },
  { id: 'p7', name: 'Camarón coctelero', unit: 'kg', price: 260, icon: '🦐' },
  { id: 'p8', name: 'Filete de mero', unit: 'kg', price: 230, icon: '🐟' },
];

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'vendedor',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg',
      price REAL NOT NULL,
      icon TEXT DEFAULT '🐟',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      customer TEXT NOT NULL,
      payment TEXT NOT NULL,
      notes TEXT,
      total REAL NOT NULL,
      pdf_path TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id TEXT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      price REAL NOT NULL,
      qty REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
  `);

  seedSettings();
  seedAdmin();
  seedProducts();
}

function seedSettings() {
  const prefix = db.prepare('SELECT value FROM settings WHERE key = ?').get('folio_prefix');
  if (!prefix) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
      .run('folio_prefix', process.env.FOLIO_PREFIX || 'CFF');
  }
  const counter = db.prepare('SELECT value FROM settings WHERE key = ?').get('folio_counter');
  if (!counter) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('folio_counter', '1');
  }
}

function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const name = process.env.ADMIN_NAME || 'Administrador';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)')
      .run(username, hash, name, 'admin');
    console.log(`[seed] Usuario administrador creado -> usuario: "${username}"  contraseña: "${password}"`);
    console.log('[seed] Cambia esta contraseña en cuanto inicies sesión por primera vez.');
  }
}

function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count === 0) {
    const insert = db.prepare(
      'INSERT INTO products (id, name, unit, price, icon) VALUES (@id, @name, @unit, @price, @icon)'
    );
    const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
    insertMany(DEFAULT_PRODUCTS);
    console.log('[seed] Catálogo por defecto creado (8 productos).');
  }
}

module.exports = { db, init };
