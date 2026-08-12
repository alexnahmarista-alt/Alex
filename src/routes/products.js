const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all();
  res.json(products);
});

router.post('/', requireRole('admin'), (req, res) => {
  const { name, price, unit, icon } = req.body || {};
  const p = Number(price);
  if (!name || !name.trim() || Number.isNaN(p) || p <= 0) {
    return res.status(400).json({ error: 'Nombre y precio válido son requeridos.' });
  }
  const id = 'p' + Date.now();
  db.prepare('INSERT INTO products (id, name, unit, price, icon) VALUES (?, ?, ?, ?, ?)').run(
    id,
    name.trim(),
    unit || 'kg',
    p,
    (icon || '🐟').trim().slice(0, 4) || '🐟'
  );
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado.' });

  const { name, price, unit, icon } = req.body || {};
  const p = price !== undefined ? Number(price) : existing.price;
  if (Number.isNaN(p) || p <= 0) return res.status(400).json({ error: 'Precio inválido.' });

  db.prepare(`UPDATE products SET name = ?, unit = ?, price = ?, icon = ?, updated_at = datetime('now') WHERE id = ?`).run(
    (name && name.trim()) || existing.name,
    unit || existing.unit,
    p,
    icon || existing.icon,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
