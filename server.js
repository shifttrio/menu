require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const XLSX    = require('xlsx');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE= path.join(DATA_DIR, 'mahsulotlar.xlsx');

fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── EXCEL HELPERS ──────────────────────────────────────────────────────────────
const COLS = ['id','nomi','narxi','kategoriya','porsiya','tavsif','tarkibi','mavjud','rasmlar','video','sana'];

function readSheet() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const wb = XLSX.readFile(DATA_FILE);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  } catch(e) {
    console.error('readSheet xato:', e.message);
    return [];
  }
}

function writeSheet(rows) {
  const wb = XLSX.utils.book_new();
  const ws = rows.length
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.aoa_to_sheet([COLS]);
  ws['!cols'] = [{wch:6},{wch:25},{wch:14},{wch:16},{wch:14},{wch:50},{wch:25},{wch:10},{wch:80},{wch:60},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws, 'Mahsulotlar');
  XLSX.writeFile(wb, DATA_FILE);
}

function nextId(rows) {
  if (!rows.length) return 1;
  return Math.max(...rows.map(r => Number(r.id) || 0)) + 1;
}

function buildItem(body, base) {
  return {
    id:         base.id,
    nomi:       body.nomi       !== undefined ? body.nomi       : (base.nomi       || ''),
    narxi:      body.narxi      !== undefined ? Number(body.narxi) : (Number(base.narxi) || 0),
    kategoriya: body.kategoriya !== undefined ? body.kategoriya : (base.kategoriya || ''),
    porsiya:    body.porsiya    !== undefined ? body.porsiya    : (base.porsiya    || ''),
    tavsif:     body.tavsif     !== undefined ? body.tavsif     : (base.tavsif     || ''),
    tarkibi:    body.tarkibi    !== undefined ? body.tarkibi    : (base.tarkibi    || ''),
    mavjud:     body.mavjud     !== undefined ? body.mavjud     : (base.mavjud     !== undefined ? base.mavjud : true),
    rasmlar:    body.rasmlar    !== undefined
                  ? (Array.isArray(body.rasmlar) ? body.rasmlar.join(',') : String(body.rasmlar || ''))
                  : (base.rasmlar || ''),
    video:      body.video      !== undefined ? body.video      : (base.video      || ''),
    sana:       base.sana || new Date().toISOString().slice(0, 10),
  };
}

// ── API ────────────────────────────────────────────────────────────────────────

app.get('/api/mahsulotlar', (req, res) => {
  try { res.json(readSheet()); }
  catch(e) { console.error('GET all:', e.message); res.status(500).json({error: e.message}); }
});

app.get('/api/mahsulotlar/kategoriya/:cat', (req, res) => {
  try { res.json(readSheet().filter(r => r.kategoriya === req.params.cat)); }
  catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/mahsulotlar/:id', (req, res) => {
  try {
    const item = readSheet().find(r => String(r.id) === String(req.params.id));
    if (!item) return res.status(404).json({error: 'Topilmadi'});
    res.json(item);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/mahsulotlar', (req, res) => {
  try {
    const rows = readSheet();
    const item = buildItem(req.body, { id: nextId(rows), sana: new Date().toISOString().slice(0,10) });
    rows.push(item);
    writeSheet(rows);
    console.log('POST qoshildi:', item.nomi);
    res.json({success: true, item});
  } catch(e) { console.error('POST xato:', e.message); res.status(500).json({error: e.message}); }
});

app.put('/api/mahsulotlar/:id', (req, res) => {
  try {
    const rows = readSheet();
    const idx  = rows.findIndex(r => String(r.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({error: 'Topilmadi'});
    const updated = buildItem(req.body, rows[idx]);
    rows[idx] = updated;
    writeSheet(rows);
    console.log('PUT yangilandi:', updated.nomi);
    res.json({success: true, item: updated});
  } catch(e) { console.error('PUT xato:', e.message); res.status(500).json({error: e.message}); }
});

app.delete('/api/mahsulotlar/:id', (req, res) => {
  try {
    const rows     = readSheet();
    const filtered = rows.filter(r => String(r.id) !== String(req.params.id));
    if (filtered.length === rows.length) return res.status(404).json({error: 'Topilmadi'});
    writeSheet(filtered);
    console.log('DELETE id:', req.params.id);
    res.json({success: true});
  } catch(e) { console.error('DELETE xato:', e.message); res.status(500).json({error: e.message}); }
});

app.get('/api/export', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) writeSheet([]);
    res.download(DATA_FILE, 'mahsulotlar.xlsx');
  } catch(e) { res.status(500).json({error: e.message}); }
});

// SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
});