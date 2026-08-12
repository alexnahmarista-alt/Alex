const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function peekNextFolio() {
  const prefix = db.prepare('SELECT value FROM settings WHERE key = ?').get('folio_prefix').value;
  const counter = db.prepare('SELECT value FROM settings WHERE key = ?').get('folio_counter').value;
  return `${prefix}-${String(counter).padStart(4, '0')}`;
}

router.get('/next-folio', (req, res) => {
  res.json({ folio: peekNextFolio() });
});

router.get('/', (req, res) => {
  const search = `%${(req.query.search || '').toLowerCase()}%`;
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const rows = db
    .prepare(
      `SELECT * FROM sales
       WHERE lower(folio) LIKE ? OR lower(customer) LIKE ?
       ORDER BY id DESC LIMIT ?`
    )
    .all(search, search, limit);

  const itemsStmt = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
  const full = rows.map((s) => ({ ...s, hasPdf: !!s.pdf_path, items: itemsStmt.all(s.id) }));
  res.json(full);
});

router.get('/:id', (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada.' });
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
  res.json({ ...sale, hasPdf: !!sale.pdf_path, items });
});

router.post('/', (req, res) => {
  const { customer, payment, notes, items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La venta debe incluir al menos un producto.' });
  }
  if (!['efectivo', 'tarjeta', 'transferencia'].includes(payment)) {
    return res.status(400).json({ error: 'Forma de pago inválida.' });
  }

  const resolved = [];
  for (const it of items) {
    const qty = Number(it.qty);
    if (!it.id || Number.isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Uno de los artículos de la venta es inválido.' });
    }
    // El precio y nombre se toman del catálogo actual en el servidor (nunca del cliente)
    // para que nadie pueda manipular el importe de la venta desde el navegador.
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(it.id);
    const name = product ? product.name : it.name || 'Producto';
    const unit = product ? product.unit : it.unit || 'pieza';
    const price = product ? product.price : Number(it.price) || 0;
    resolved.push({ product_id: it.id, name, unit, price, qty, subtotal: price * qty });
  }
  const total = resolved.reduce((s, it) => s + it.subtotal, 0);

  const create = db.transaction(() => {
    const prefix = db.prepare('SELECT value FROM settings WHERE key = ?').get('folio_prefix').value;
    const counterRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('folio_counter');
    const counter = Number(counterRow.value);
    const folio = `${prefix}-${String(counter).padStart(4, '0')}`;
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(counter + 1), 'folio_counter');

    const info = db
      .prepare(
        `INSERT INTO sales (folio, date, customer, payment, notes, total, created_by)
         VALUES (?, datetime('now'), ?, ?, ?, ?, ?)`
      )
      .run(folio, (customer || 'Cliente mostrador').trim(), payment, (notes || '').trim(), total, req.user.sub);

    const saleId = info.lastInsertRowid;
    const insertItem = db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, name, unit, price, qty, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    resolved.forEach((it) => insertItem.run(saleId, it.product_id, it.name, it.unit, it.price, it.qty, it.subtotal));

    return saleId;
  });

  const saleId = create();
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  const savedItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  res.status(201).json({ ...sale, items: savedItems, hasPdf: false });
});

module.exports = router;
