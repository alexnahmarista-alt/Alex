const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'receipts');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
});

const router = express.Router();
router.use(requireAuth);

// Lista de comprobantes ya generados (para la pestaña "PDFs descargados")
router.get('/', (req, res) => {
  const search = `%${(req.query.search || '').toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT id, folio, date, customer, payment, total, pdf_path FROM sales
       WHERE pdf_path IS NOT NULL AND (lower(folio) LIKE ? OR lower(customer) LIKE ?)
       ORDER BY id DESC`
    )
    .all(search, search);
  res.json(rows.map((r) => ({ ...r, hasPdf: true })));
});

// El navegador genera el PDF visual (html2canvas + jsPDF) y lo sube aquí para
// que quede guardado en el servidor y disponible desde cualquier dispositivo.
router.post('/:id/pdf', upload.single('file'), (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada.' });
  if (!req.file) return res.status(400).json({ error: 'Archivo PDF requerido.' });

  const filename = `${sale.folio}.pdf`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
  db.prepare('UPDATE sales SET pdf_path = ? WHERE id = ?').run(filename, sale.id);
  res.json({ ok: true, folio: sale.folio });
});

router.get('/:id/pdf', (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale || !sale.pdf_path) {
    return res.status(404).json({ error: 'No hay PDF guardado para esta venta todavía.' });
  }
  const filePath = path.join(UPLOAD_DIR, sale.pdf_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'El archivo ya no está disponible en el servidor.' });
  }
  res.download(filePath, sale.pdf_path);
});

module.exports = router;
