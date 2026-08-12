const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY id').all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  const finalRole = role === 'admin' ? 'admin' : 'vendedor';

  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare('INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)')
      .run(username.trim(), hash, name.trim(), finalRole);
    res.status(201).json({ id: info.lastInsertRowid, username: username.trim(), name: name.trim(), role: finalRole });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
    }
    res.status(500).json({ error: 'No se pudo crear el usuario.' });
  }
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
  }
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
