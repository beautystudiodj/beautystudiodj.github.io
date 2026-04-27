const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;

async function readDb(){
  try{ const txt = await fs.readFile(DB_FILE, 'utf8'); return JSON.parse(txt || '{}'); }catch(e){ return { products: [] }; }
}
async function writeDb(db){
  try{ await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); }catch(e){ console.error('Error writing DB', e); }
}

const app = express();
app.use(cors());
app.use(express.json());

// Serve site static files from parent folder (convenience for local dev)
app.use('/', express.static(path.join(__dirname, '..')));

app.get('/api/ping', (req, res) => res.json({ ok: true }));

app.get('/api/products', async (req, res) => {
  const db = await readDb();
  res.json(db.products || []);
});

app.post('/api/products', async (req, res) => {
  const body = req.body || {};
  const db = await readDb();
  db.products = db.products || [];
  const id = 'p' + Date.now() + Math.floor(Math.random()*900 + 100);
  const prod = Object.assign({ id }, body);
  db.products.unshift(prod);
  await writeDb(db);
  res.status(201).json(prod);
});

app.put('/api/products/:id', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const db = await readDb();
  db.products = db.products || [];
  const idx = db.products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  db.products[idx] = Object.assign({}, db.products[idx], body, { id });
  await writeDb(db);
  res.json(db.products[idx]);
});

app.post('/api/products/bulk-stock', async (req, res) => {
  const updates = Array.isArray(req.body) ? req.body : (req.body.updates || []);
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'invalid payload' });
  const db = await readDb();
  db.products = db.products || [];
  updates.forEach(u => {
    const idx = db.products.findIndex(p => p.id === u.id);
    if (idx !== -1 && typeof u.stock === 'number') db.products[idx].stock = u.stock;
  });
  await writeDb(db);
  res.json({ ok: true });
});

// Invoices endpoints
app.get('/api/invoices', async (req, res) => {
  const db = await readDb();
  res.json(db.invoices || []);
});

app.post('/api/invoices', async (req, res) => {
  const body = req.body || {};
  const db = await readDb();
  db.invoices = db.invoices || [];
  const id = 'inv' + Date.now() + Math.floor(Math.random()*900 + 100);
  const inv = Object.assign({ id }, body, { createdAt: body.createdAt || Date.now(), status: body.status || 'pending' });
  db.invoices.unshift(inv);
  await writeDb(db);
  res.status(201).json(inv);
});

app.put('/api/invoices/:id', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const db = await readDb();
  db.invoices = db.invoices || [];
  const idx = db.invoices.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  db.invoices[idx] = Object.assign({}, db.invoices[idx], body, { id });
  await writeDb(db);
  res.json(db.invoices[idx]);
});

// Confirm invoice: deduct stock for invoice items and mark invoice confirmed
app.post('/api/invoices/:id/confirm', async (req, res) => {
  const id = req.params.id;
  const db = await readDb();
  db.invoices = db.invoices || [];
  db.products = db.products || [];
  const idx = db.invoices.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const inv = db.invoices[idx];
  // for each item, find product and decrement stock
  (inv.items || []).forEach(item => {
    const pid = item.id || null;
    let pidx = -1;
    if (pid) pidx = db.products.findIndex(p => p.id === pid);
    if (pidx === -1 && item.name) pidx = db.products.findIndex(p => (p.title||p.name||'') === item.name);
    if (pidx !== -1){
      const cur = Number(db.products[pidx].stock || 0);
      const qty = Number(item.qty || 0);
      db.products[pidx].stock = Math.max(0, cur - qty);
    }
  });
  inv.status = 'confirmed';
  inv.confirmedAt = Date.now();
  db.invoices[idx] = inv;
  await writeDb(db);
  res.json({ invoice: inv });
});

app.delete('/api/products/:id', async (req, res) => {
  const id = req.params.id;
  const db = await readDb();
  const before = (db.products || []).length;
  db.products = (db.products || []).filter(p => p.id !== id);
  await writeDb(db);
  res.json({ deleted: before - db.products.length });
});

app.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));
