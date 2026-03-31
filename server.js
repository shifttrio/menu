require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── PostgreSQL ulanish ─────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.PG_HOST     || 'centerbeam.proxy.rlwy.net',
  port:     Number(process.env.PG_PORT) || 52009,
  database: process.env.PG_DATABASE || 'railway',
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'mbWGYQiPiLIfkzkmxCndaliSqxMedJsa',
  ssl:      process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ── Jadval yaratish (agar mavjud bo'lmasa) ─────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mahsulotlar (
      id         SERIAL PRIMARY KEY,
      nomi       TEXT        NOT NULL DEFAULT '',
      narxi      NUMERIC     NOT NULL DEFAULT 0,
      kategoriya TEXT        NOT NULL DEFAULT '',
      porsiya    TEXT                 DEFAULT '',
      tavsif     TEXT                 DEFAULT '',
      tarkibi    TEXT                 DEFAULT '',
      mavjud     BOOLEAN     NOT NULL DEFAULT TRUE,
      rasmlar    TEXT                 DEFAULT '',
      video      TEXT                 DEFAULT '',
      sana       DATE        NOT NULL DEFAULT CURRENT_DATE
    );
  `);
  console.log('✅ Jadval tayyor: mahsulotlar');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API ────────────────────────────────────────────────────────────────────────

// Barcha mahsulotlar
app.get('/api/mahsulotlar', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM mahsulotlar ORDER BY id ASC');
    res.json(rows);
  } catch(e) {
    console.error('GET all:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Kategoriya bo'yicha
app.get('/api/mahsulotlar/kategoriya/:cat', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM mahsulotlar WHERE kategoriya = $1 ORDER BY id ASC',
      [req.params.cat]
    );
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Bitta mahsulot
app.get('/api/mahsulotlar/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM mahsulotlar WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Yangi mahsulot qo'shish
app.post('/api/mahsulotlar', async (req, res) => {
  try {
    const b = req.body;
    const rasmlar = Array.isArray(b.rasmlar) ? b.rasmlar.join(',') : String(b.rasmlar || '');
    const mavjud  = b.mavjud !== undefined ? b.mavjud : true;

    const { rows } = await pool.query(
      `INSERT INTO mahsulotlar
         (nomi, narxi, kategoriya, porsiya, tavsif, tarkibi, mavjud, rasmlar, video, sana)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE)
       RETURNING *`,
      [
        b.nomi       || '',
        Number(b.narxi) || 0,
        b.kategoriya || '',
        b.porsiya    || '',
        b.tavsif     || '',
        b.tarkibi    || '',
        mavjud,
        rasmlar,
        b.video      || '',
      ]
    );
    console.log('POST qoshildi:', rows[0].nomi);
    res.json({ success: true, item: rows[0] });
  } catch(e) {
    console.error('POST xato:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Mahsulotni yangilash
app.put('/api/mahsulotlar/:id', async (req, res) => {
  try {
    const b = req.body;
    const rasmlar = Array.isArray(b.rasmlar) ? b.rasmlar.join(',') : String(b.rasmlar || '');

    const { rows } = await pool.query(
      `UPDATE mahsulotlar SET
         nomi       = $1,
         narxi      = $2,
         kategoriya = $3,
         porsiya    = $4,
         tavsif     = $5,
         tarkibi    = $6,
         mavjud     = $7,
         rasmlar    = $8,
         video      = $9
       WHERE id = $10
       RETURNING *`,
      [
        b.nomi       || '',
        Number(b.narxi) || 0,
        b.kategoriya || '',
        b.porsiya    || '',
        b.tavsif     || '',
        b.tarkibi    || '',
        b.mavjud !== undefined ? b.mavjud : true,
        rasmlar,
        b.video      || '',
        req.params.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
    console.log('PUT yangilandi:', rows[0].nomi);
    res.json({ success: true, item: rows[0] });
  } catch(e) {
    console.error('PUT xato:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Mahsulotni o'chirish
app.delete('/api/mahsulotlar/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM mahsulotlar WHERE id = $1',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Topilmadi' });
    console.log('DELETE id:', req.params.id);
    res.json({ success: true });
  } catch(e) {
    console.error('DELETE xato:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Excel export (pg-dan yuklab olish)
app.get('/api/export', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const { rows } = await pool.query('SELECT * FROM mahsulotlar ORDER BY id ASC');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Mahsulotlar');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="mahsulotlar.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e) {
    console.error('Export xato:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START ──────────────────────────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server: http://localhost:${PORT}`);
    });
  })
  .catch(e => {
    console.error('❌ DB ulanishda xato:', e.message);
    process.exit(1);
  });