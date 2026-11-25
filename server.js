import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CURRENCY = process.env.CURRENCY || 'сомони';
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('hj-market:' + ADMIN_PASSWORD).digest('hex');
const STATUSES = ['Новый', 'Подтверждён', 'Собирается', 'Отправлен', 'Доставлен', 'Отменён'];

/* ---------- Хранилище (файл db.json + папка uploads на Volume) ---------- */
fs.mkdirSync(UPLOADS, { recursive: true });
const fresh = !fs.existsSync(DB_FILE);
const db = { seq: 1, orderNo: 0, categories: [], products: [], orders: [], reviews: [], profiles: {} };
if (!fresh) {
  try {
    Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (e) {
    console.error('Файл базы повреждён, запуск остановлен:', e.message);
    process.exit(1);
  }
}
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
const nid = () => db.seq++;
if (fresh) {
  ['Парфюм и духи', 'Ремни', 'Часы', 'Кольца', 'Другое'].forEach((name) => db.categories.push({ id: nid(), name }));
  save();
}

/* ---------- Вспомогательные функции ---------- */
const httpErr = (m, c = 400) => Object.assign(new Error(m), { status: c });
const bad = (res, m, c = 400) => res.status(c).json({ error: m });
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

function saveImage(d) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ''));
  if (!m) throw httpErr('Нужно фото в формате JPG, PNG или WebP');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) throw httpErr('Фото больше 4 МБ');
  const name = crypto.randomBytes(12).toString('hex') + (m[1] === 'jpeg' ? '.jpg' : '.' + m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return '/uploads/' + name;
}
function removeImage(url) {
  const m = /^\/uploads\/([a-f0-9]+\.(jpg|png|webp))$/.exec(url || '');
  if (m) fs.rm(path.join(UPLOADS, m[1]), () => {});
}

/* ---------- Админ-токен (подписанный, живёт 12 часов) ---------- */
const sign = (p) => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
const makeToken = () => {
  const p = 'admin.' + (Date.now() + 12 * 3600 * 1000);
  return p + '.' + sign(p);
};
function checkToken(t) {
  const parts = String(t || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'admin') return false;
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(sign(parts[0] + '.' + parts[1]));
  return a.length === b.length && crypto.timingSafeEqual(a, b) && Number(parts[1]) > Date.now();
}
function requireAdmin(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!ADMIN_PASSWORD || !m || !checkToken(m[1])) return bad(res, 'Нет доступа', 401);
  next();
}

/* ---------- Личность покупателя ---------- */
// Telegram: подтверждается ТОЛЬКО подписью initData (нужен TELEGRAM_BOT_TOKEN).
function tgUser(initData) {
  if (!BOT_TOKEN || !initData) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const dcs = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const key = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc = Buffer.from(crypto.createHmac('sha256', key).update(dcs).digest('hex'));
  const got = Buffer.from(hash);
  if (calc.length !== got.length || !crypto.timingSafeEqual(calc, got)) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date')) > 86400) return null;
  try {
    const u = JSON.parse(p.get('user'));
    return u && u.id ? u : null;
  } catch {
    return null;
  }
}
// Обычный браузер: случайный секрет устройства. Это НЕ подтверждение Telegram-личности.
function ident(req, res, next) {
  const u = tgUser(req.headers['x-tg-init-data']);
  if (u) {
    req.uid = 'tg:' + u.id;
    req.tg = u;
  } else {
    const d = String(req.headers['x-device-id'] || '');
    if (!/^[a-f0-9]{32}$/.test(d)) return bad(res, 'Нет идентификатора устройства', 401);
    req.uid = 'web:' + sha(d).toString('hex').slice(0, 32);
  }
  next();
}
const shownName = (req) => str((db.profiles[req.uid] || {}).firstName || (req.tg && req.tg.first_name) || 'Покупатель', 40);

/* ---------- Товары ---------- */
const sold = (id) =>
  db.orders.reduce((s, o) => (o.status === 'Отменён' ? s : s + o.items.filter((i) => i.productId === id).reduce((a, i) => a + i.qty, 0)), 0);
function pub(p) {
  const rv = db.reviews.filter((r) => r.productId === p.id);
  const rating = rv.length ? Math.round((rv.reduce((s, r) => s + r.rating, 0) / rv.length) * 10) / 10 : 0;
  return { id: p.id, categoryId: p.categoryId, name: p.name, desc: p.desc, price: p.price, stock: p.stock, image: p.image, rating, reviews: rv.length, sold: sold(p.id) };
}
function readProduct(b, old) {
  b = b || {};
  const name = str(b.name, 100);
  if (!name) throw httpErr('Введите название товара');
  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0 || price > 1e9) throw httpErr('Неверная цена');
  const stock = Number(b.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 1e6) throw httpErr('Количество на складе — целое число от 0');
  const categoryId = Number(b.categoryId);
  if (!db.categories.some((c) => c.id === categoryId)) throw httpErr('Выберите категорию');
  let image = old ? old.image : '';
  if (b.photo) {
    const u = saveImage(b.photo);
    if (old) removeImage(old.image);
    image = u;
  }
  return { name, desc: str(b.desc, 500), price: Math.round(price * 100) / 100, stock, categoryId, image };
}

/* ---------- Приложение ---------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '7mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/config', (req, res) => res.json({ currency: CURRENCY, statuses: STATUSES, telegram: !!BOT_TOKEN }));
app.get('/api/categories', (req, res) => res.json(db.categories));
app.get('/api/products', (req, res) => res.json([...db.products].sort((a, b) => b.id - a.id).map(pub)));
app.get('/api/products/:id/reviews', (req, res) => {
  const id = Number(req.params.id);
  res.json(
    db.reviews
      .filter((r) => r.productId === id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(({ id: rid, name, rating, text, date }) => ({ id: rid, name, rating, text, date }))
  );
});

/* ---------- Отзывы, профиль, заказы покупателя ---------- */
app.post('/api/products/:id/reviews', ident, (req, res) => {
  const p = db.products.find((x) => x.id === Number(req.params.id));
  if (!p) return bad(res, 'Товар не найден', 404);
  const rating = Number(req.body && req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad(res, 'Поставьте оценку от 1 до 5');
  const text = str(req.body.text, 500);
  const name = shownName(req);
  const date = new Date().toISOString();
  const r = db.reviews.find((x) => x.productId === p.id && x.uid === req.uid);
  if (r) Object.assign(r, { rating, text, name, date });
  else db.reviews.push({ id: nid(), productId: p.id, uid: req.uid, name, rating, text, date });
  save();
  res.json({ ok: true });
});

app.get('/api/profile', ident, (req, res) => {
  const p = db.profiles[req.uid] || {
    firstName: str(req.tg && req.tg.first_name, 40),
    lastName: str(req.tg && req.tg.last_name, 40),
    middleName: '',
    phone: '',
    address: '',
    photo: ''
  };
  res.json({ profile: p, via: req.tg ? 'telegram' : 'web' });
});

app.put('/api/profile', ident, (req, res) => {
  const b = req.body || {};
  const old = db.profiles[req.uid] || {};
  const phone = str(b.phone, 20);
  if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) return bad(res, 'Неверный номер телефона');
  let photo = old.photo || '';
  if (b.photo === '') {
    removeImage(photo);
    photo = '';
  } else if (b.photo) {
    const u = saveImage(b.photo);
    removeImage(photo);
    photo = u;
  }
  db.profiles[req.uid] = {
    firstName: str(b.firstName, 40),
    lastName: str(b.lastName, 40),
    middleName: str(b.middleName, 40),
    phone,
    address: str(b.address, 300),
    photo
  };
  save();
  res.json(db.profiles[req.uid]);
});

app.get('/api/orders', ident, (req, res) =>
  res.json({
    orders: db.orders
      .filter((o) => o.uid === req.uid)
      .map(({ id, items, total, status, date }) => ({ id, items, total, status, date }))
      .reverse()
  })
);

app.post('/api/orders', ident, (req, res) => {
  const pr = db.profiles[req.uid] || {};
  if (!pr.firstName || !pr.phone || !pr.address) return bad(res, 'Заполните имя, телефон и адрес в профиле');
  const list = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  if (!list.length || list.length > 100) return bad(res, 'Выберите товары для заказа');
  const merged = new Map();
  for (const it of list) {
    const id = Number(it.id);
    const q = Math.floor(Number(it.qty));
    if (!(id > 0) || !(q > 0) || q > 99) return bad(res, 'Неверные данные корзины');
    merged.set(id, (merged.get(id) || 0) + q);
  }
  const items = [];
  let total = 0;
  for (const [id, q] of merged) {
    const p = db.products.find((x) => x.id === id);
    if (!p) return bad(res, 'Один из товаров больше недоступен');
    if (p.stock < q) return bad(res, `«${p.name}»: в наличии только ${p.stock} шт.`);
    items.push({ productId: id, name: p.name, price: p.price, qty: q, image: p.image });
    total += p.price * q;
  }
  items.forEach((it) => {
    db.products.find((x) => x.id === it.productId).stock -= it.qty;
  });
  const order = {
    id: ++db.orderNo,
    uid: req.uid,
    name: [pr.lastName, pr.firstName, pr.middleName].filter(Boolean).join(' '),
    phone: pr.phone,
    address: pr.address,
    items,
    total: Math.round(total * 100) / 100,
    status: 'Новый',
    date: new Date().toISOString()
  };
  db.orders.push(order);
  save();
  res.json({ id: order.id, total: order.total });
});

/* ---------- Администратор ---------- */
const attempts = new Map();
app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) return bad(res, 'На сервере не задан ADMIN_PASSWORD', 503);
  const a = attempts.get(req.ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60 * 1000) {
    a.n = 0;
    a.t = Date.now();
  }
  if (a.n >= 10) return bad(res, 'Слишком много попыток. Подождите 15 минут', 429);
  const ok = crypto.timingSafeEqual(sha(req.body && req.body.password), sha(ADMIN_PASSWORD));
  if (!ok) {
    a.n++;
    attempts.set(req.ip, a);
    return bad(res, 'Неверный пароль', 401);
  }
  attempts.delete(req.ip);
  res.json({ token: makeToken() });
});

const adm = express.Router();
adm.use(requireAdmin);

adm.get('/stats', (req, res) => {
  const ok = db.orders.filter((o) => o.status !== 'Отменён');
  const per = {};
  ok.forEach((o) => o.items.forEach((i) => (per[i.name] = (per[i.name] || 0) + i.qty)));
  res.json({
    orders: db.orders.length,
    active: ok.length,
    revenue: Math.round(ok.reduce((s, o) => s + o.total, 0) * 100) / 100,
    items: Object.values(per).reduce((a, b) => a + b, 0),
    reviews: db.reviews.length,
    top: Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, qty]) => ({ name, qty }))
  });
});

adm.get('/orders', (req, res) => res.json([...db.orders].reverse()));
adm.put('/orders/:id', (req, res) => {
  const o = db.orders.find((x) => x.id === Number(req.params.id));
  if (!o) return bad(res, 'Заказ не найден', 404);
  const s = req.body && req.body.status;
  if (!STATUSES.includes(s)) return bad(res, 'Неверный статус');
  if (s === 'Отменён' && o.status !== 'Отменён') {
    o.items.forEach((i) => {
      const p = db.products.find((x) => x.id === i.productId);
      if (p) p.stock += i.qty;
    });
  }
  if (o.status === 'Отменён' && s !== 'Отменён') {
    const need = o.items.map((i) => [db.products.find((x) => x.id === i.productId), i.qty]);
    if (need.some(([p, q]) => p && p.stock < q)) return bad(res, 'На складе не хватает товара, чтобы вернуть заказ в работу');
    need.forEach(([p, q]) => {
      if (p) p.stock -= q;
    });
  }
  o.status = s;
  save();
  res.json(o);
});

adm.post('/categories', (req, res) => {
  const name = str(req.body && req.body.name, 40);
  if (!name) return bad(res, 'Введите название категории');
  const c = { id: nid(), name };
  db.categories.push(c);
  save();
  res.json(c);
});
adm.put('/categories/:id', (req, res) => {
  const c = db.categories.find((x) => x.id === Number(req.params.id));
  const name = str(req.body && req.body.name, 40);
  if (!c) return bad(res, 'Категория не найдена', 404);
  if (!name) return bad(res, 'Введите название категории');
  c.name = name;
  save();
  res.json(c);
});
adm.delete('/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.categories.some((x) => x.id === id)) return bad(res, 'Категория не найдена', 404);
  if (db.products.some((p) => p.categoryId === id)) return bad(res, 'В категории есть товары. Сначала перенесите или удалите их');
  db.categories = db.categories.filter((x) => x.id !== id);
  save();
  res.json({ ok: true });
});

adm.post('/products', (req, res) => {
  const p = { id: nid(), ...readProduct(req.body) };
  db.products.push(p);
  save();
  res.json(pub(p));
});
adm.put('/products/:id', (req, res) => {
  const p = db.products.find((x) => x.id === Number(req.params.id));
  if (!p) return bad(res, 'Товар не найден', 404);
  Object.assign(p, readProduct(req.body, p));
  save();
  res.json(pub(p));
});
adm.delete('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = db.products.find((x) => x.id === id);
  if (!p) return bad(res, 'Товар не найден', 404);
  removeImage(p.image);
  db.products = db.products.filter((x) => x.id !== id);
  db.reviews = db.reviews.filter((r) => r.productId !== id);
  save();
  res.json({ ok: true });
});

adm.get('/reviews', (req, res) =>
  res.json(
    [...db.reviews]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => ({
        id: r.id,
        name: r.name,
        rating: r.rating,
        text: r.text,
        date: r.date,
        product: (db.products.find((p) => p.id === r.productId) || {}).name || 'Удалённый товар'
      }))
  )
);
adm.delete('/reviews/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.reviews.some((r) => r.id === id)) return bad(res, 'Отзыв не найден', 404);
  db.reviews = db.reviews.filter((r) => r.id !== id);
  save();
  res.json({ ok: true });
});
app.use('/api/admin', adm);

/* ---------- Страницы и файлы ---------- */
app.use('/uploads', express.static(UPLOADS, { maxAge: '30d', immutable: true, index: false }));
const INDEX = path.join(__dirname, 'index.html');
app.get(['/', '/admin'], (req, res) => res.sendFile(INDEX));
app.use('/api', (req, res) => bad(res, 'Не найдено', 404));
app.use((req, res) => res.status(404).type('text').send('Страница не найдена'));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const s = err.status || 500;
  if (s >= 500) console.error(err);
  const msg = err.type === 'entity.too.large' ? 'Файл слишком большой' : s < 500 ? err.message : 'Ошибка сервера';
  res.status(s).json({ error: msg });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HJ PREMIUM MARKET запущен на порту ${PORT}`);
  console.log(`Данные хранятся в: ${DATA_DIR}`);
  if (!ADMIN_PASSWORD) console.warn('ВНИМАНИЕ: ADMIN_PASSWORD не задан — админ-панель закрыта.');
  if (!BOT_TOKEN) console.warn('TELEGRAM_BOT_TOKEN не задан — вход через Telegram пока не подтверждается.');
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.DATA_DIR && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.warn('ВНИМАНИЕ: Volume не подключён — данные пропадут при новом деплое!');
  }
});
