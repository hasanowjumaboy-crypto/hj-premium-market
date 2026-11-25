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
const DATA_DIR =
  process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(__dirname, 'data');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update('hj-market:' + ADMIN_PASSWORD).digest('hex');

const STATUSES = ['Новый', 'Подтверждён', 'Собирается', 'Отправлен', 'Доставлен', 'Отменён'];

fs.mkdirSync(UPLOADS, { recursive: true });

const db = {
  seq: 1,
  orderNo: 0,
  categories: [],
  products: [],
  orders: [],
  reviews: [],
  profiles: {}
};

if (fs.existsSync(DB_FILE)) {
  try {
    Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (error) {
    console.error('Не удалось прочитать базу данных:', error);
    process.exit(1);
  }
} else {
  ['Парфюм и духи', 'Ремни', 'Часы', 'Кольца', 'Другое'].forEach(name => {
    db.categories.push({ id: db.seq++, name });
  });
  save();
}


if (!db.demoCatalogSeeded) {
  const cat = name => db.categories.find(c => c.name === name)?.id;
  const demo = [
    ["Aurelia Amber Eau de Parfum 100 мл","Тёплый янтарь, ваниль и мягкие древесные ноты. Элегантный вечерний аромат с выразительным шлейфом.",189,"Парфюм и духи",18,"https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=900&q=85"],
    ["Rose Élégance Eau de Parfum 80 мл","Нежная роза, пион и белый мускус. Романтичный цветочный аромат на каждый день.",175,"Парфюм и духи",15,"https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=85"],
    ["Noir Oud Intense 100 мл","Глубокий уд, шафран и благородная древесина. Насыщенная восточная композиция.",225,"Парфюм и духи",12,"https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=900&q=85"],
    ["Aqua Marine Fresh 100 мл","Свежие цитрусы, морской аккорд и прохладный кедр. Универсальный аромат для активного дня.",165,"Парфюм и духи",20,"https://images.unsplash.com/photo-1590736969955-71cc94901144?auto=format&fit=crop&w=900&q=85"],
    ["Velvet Musk Signature 90 мл","Белый мускус, ирис и сандал. Сдержанный премиальный аромат с мягким шлейфом.",199,"Парфюм и духи",14,"https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?auto=format&fit=crop&w=900&q=85"],
    ["Chrono Steel — мужские часы","Стальной корпус, лаконичный циферблат и удобный браслет. Для делового и повседневного стиля.",420,"Часы",8,"https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=900&q=85"],
    ["Golden Classic — женские часы","Золотистый браслет и светлый циферблат. Элегантный аксессуар на каждый день и для особых случаев.",395,"Часы",7,"https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=85"],
    ["Midnight Black Chronograph","Чёрный корпус, контрастные метки и спортивный хронограф. Выразительный городской стиль.",465,"Часы",6,"https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=85"],
    ["Heritage Leather Watch","Классический циферблат и ремешок под кожу. Сдержанная модель к рубашке и casual-образу.",360,"Часы",9,"https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=900&q=85"],
    ["Urban Silver Minimal","Минималистичный серебристый корпус и чистый циферблат. Универсальные часы на каждый день.",335,"Часы",10,"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85"],
    ["Luna Crystal — женское кольцо","Изящное кольцо с центральным кристаллом и сияющей дорожкой. Размеры: 16–22.",245,"Кольца",10,"https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=85"],
    ["Titan Signet — мужское кольцо","Мужской перстень с гладкой полированной площадкой и строгим силуэтом. Размеры: 18–24.",285,"Кольца",8,"https://images.unsplash.com/photo-1603561596112-0d8b7b2f3d9b?auto=format&fit=crop&w=900&q=85"],
    ["Executive Black Leather Belt","Чёрный ремень с классической металлической пряжкой. Универсальный аксессуар к деловому гардеробу.",145,"Ремни",12,"https://images.unsplash.com/photo-1624222247344-550fb8f5f2c3?auto=format&fit=crop&w=900&q=85"],
    ["Cognac Heritage Belt","Ремень оттенка коньяк с выразительной фактурой и тёплой металлической пряжкой.",155,"Ремни",10,"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=85"],
    ["Urban Matte Buckle Belt","Глубокий чёрный цвет, матовая пряжка и минималистичный дизайн.",135,"Ремни",14,"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85"],
    ["Classic Tan Leather Belt","Тёплый песочно-коричневый оттенок и серебристая пряжка. Практичная модель на каждый день.",139,"Ремни",11,"https://images.unsplash.com/photo-1622560480654-d96214fdc887?auto=format&fit=crop&w=900&q=85"],
    ["Textured Black Premium Belt","Чёрный ремень с рельефной фактурой и выразительной пряжкой.",169,"Ремни",9,"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=85"]
  ];
  for (const [name,desc,price,category,stock,image] of demo) {
    db.products.push({id:nextId(),name,desc,price,stock,categoryId:cat(category),image,
      ...(category === "Кольца" ? {sizes:name.startsWith("Luna")?["16","17","18","19","20","21","22"]:["18","19","20","21","22","23","24"]} : {})});
  }
  db.demoCatalogSeeded = true;
  save();
}

function save() {
  const tempFile = DB_FILE + '.tmp';
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2));
  fs.renameSync(tempFile, DB_FILE);
}

function nextId() {
  return db.seq++;
}

function text(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest();
}

function errorResponse(res, message, status = 400) {
  return res.status(status).json({ error: message });
}

function saveImage(data) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(data || ''));
  if (!match) throw Object.assign(new Error('Загрузите фото JPG, PNG или WebP'), { status: 400 });

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 4 * 1024 * 1024) {
    throw Object.assign(new Error('Фото должно быть не больше 4 МБ'), { status: 400 });
  }

  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = crypto.randomBytes(12).toString('hex') + '.' + extension;
  fs.writeFileSync(path.join(UPLOADS, filename), buffer);
  return '/uploads/' + filename;
}

function removeImage(url) {
  const match = /^\/uploads\/([a-f0-9]+\.(jpg|png|webp))$/.exec(url || '');
  if (match) fs.rm(path.join(UPLOADS, match[1]), () => {});
}

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function makeAdminToken() {
  const payload = 'admin.' + (Date.now() + 12 * 60 * 60 * 1000);
  return payload + '.' + sign(payload);
}

function validAdminToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'admin') return false;

  const expected = Buffer.from(sign(parts[0] + '.' + parts[1]));
  const received = Buffer.from(parts[2]);
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected) &&
    Number(parts[1]) > Date.now()
  );
}

function requireAdmin(req, res, next) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!ADMIN_PASSWORD || !match || !validAdminToken(match[1])) {
    return errorResponse(res, 'Нет доступа', 401);
  }
  next();
}

function telegramUser(initData) {
  if (!BOT_TOKEN || !initData) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const a = Buffer.from(calculatedHash);
  const b = Buffer.from(receivedHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

  try {
    const user = JSON.parse(params.get('user') || '{}');
    return user.id ? user : null;
  } catch {
    return null;
  }
}

function identifyCustomer(req, res, next) {
  const telegram = telegramUser(req.headers['x-tg-init-data']);

  if (telegram) {
    req.uid = 'tg:' + telegram.id;
    req.telegram = telegram;
    return next();
  }

  const deviceId = String(req.headers['x-device-id'] || '');
  if (!/^[a-f0-9]{32}$/.test(deviceId)) {
    return errorResponse(res, 'Нет идентификатора устройства', 401);
  }

  req.uid = 'web:' + hash(deviceId).toString('hex').slice(0, 32);
  next();
}

function customerName(req) {
  const profile = db.profiles[req.uid] || {};
  return text(
    profile.firstName || (req.telegram && req.telegram.first_name) || 'Покупатель',
    40
  );
}

function soldCount(productId) {
  return db.orders.reduce((sum, order) => {
    if (order.status === 'Отменён') return sum;
    return sum + order.items
      .filter(item => item.productId === productId)
      .reduce((itemSum, item) => itemSum + item.qty, 0);
  }, 0);
}

function publicProduct(product) {
  const reviews = db.reviews.filter(review => review.productId === product.id);
  const rating = reviews.length
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    desc: product.desc,
    price: product.price,
    stock: product.stock,
    image: product.image,
    rating,
    reviews: reviews.length,
    sizes: product.sizes || [],
    sold: soldCount(product.id)
  };
}

function readProduct(body, oldProduct = null) {
  const data = body || {};
  const name = text(data.name, 100);
  if (!name) throw Object.assign(new Error('Введите название товара'), { status: 400 });

  const price = Number(data.price);
  if (!Number.isFinite(price) || price < 0 || price > 1e9) {
    throw Object.assign(new Error('Укажите правильную цену'), { status: 400 });
  }

  const stock = Number(data.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 1e6) {
    throw Object.assign(new Error('Количество должно быть целым числом от 0'), { status: 400 });
  }

  const categoryId = Number(data.categoryId);
  if (!db.categories.some(category => category.id === categoryId)) {
    throw Object.assign(new Error('Выберите категорию'), { status: 400 });
  }

  let image = oldProduct ? oldProduct.image : '';
  if (data.photo) {
    const newImage = saveImage(data.photo);
    if (oldProduct) removeImage(oldProduct.image);
    image = newImage;
  }

  return {
    name,
    desc: text(data.desc, 500),
    price: Math.round(price * 100) / 100,
    stock,
    categoryId,
    image
  };
}

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

// Проверка состояния сервера
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'HJ PREMIUM MARKET' });
});

app.get('/api/config', (req, res) => {
  res.json({ currency: CURRENCY, statuses: STATUSES, telegram: Boolean(BOT_TOKEN) });
});

app.get('/api/categories', (req, res) => res.json(db.categories));

app.get('/api/products', (req, res) => {
  res.json([...db.products].sort((a, b) => b.id - a.id).map(publicProduct));
});

app.get('/api/products/:id/reviews', (req, res) => {
  const productId = Number(req.params.id);
  res.json(
    db.reviews
      .filter(review => review.productId === productId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(({ id, name, rating, text: reviewText, date }) => ({
        id, name, rating, text: reviewText, date
      }))
  );
});

app.post('/api/products/:id/reviews', identifyCustomer, (req, res) => {
  const product = db.products.find(item => item.id === Number(req.params.id));
  if (!product) return errorResponse(res, 'Товар не найден', 404);

  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return errorResponse(res, 'Поставьте оценку от 1 до 5');
  }

  const reviewText = text(req.body?.text, 500);
  const name = customerName(req);
  const date = new Date().toISOString();
  const existing = db.reviews.find(review =>
    review.productId === product.id && review.uid === req.uid
  );

  if (existing) {
    Object.assign(existing, { rating, text: reviewText, name, date });
  } else {
    db.reviews.push({
      id: nextId(),
      productId: product.id,
      uid: req.uid,
      rating,
      text: reviewText,
      name,
      date
    });
  }

  save();
  res.json({ ok: true });
});

app.get('/api/profile', identifyCustomer, (req, res) => {
  const profile = db.profiles[req.uid] || {
    firstName: text(req.telegram?.first_name, 40),
    lastName: text(req.telegram?.last_name, 40),
    middleName: '',
    phone: '',
    address: '',
    photo: ''
  };
  res.json({ profile, via: req.telegram ? 'telegram' : 'web' });
});

app.put('/api/profile', identifyCustomer, (req, res) => {
  const body = req.body || {};
  const old = db.profiles[req.uid] || {};
  const firstName = text(body.firstName, 40);
  const phone = text(body.phone, 20);

  if (!firstName) return errorResponse(res, 'Укажите имя');
  if (!phone) return errorResponse(res, 'Укажите номер телефона');
  if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
    return errorResponse(res, 'Неверный номер телефона');
  }

  let photo = old.photo || '';
  if (body.photo === '') {
    removeImage(photo);
    photo = '';
  } else if (body.photo) {
    const newPhoto = saveImage(body.photo);
    removeImage(photo);
    photo = newPhoto;
  }

  db.profiles[req.uid] = {
    firstName,
    lastName: text(body.lastName, 40),
    middleName: text(body.middleName, 40),
    phone,
    address: text(body.address, 300),
    photo
  };

  save();
  res.json(db.profiles[req.uid]);
});

app.get('/api/orders', identifyCustomer, (req, res) => {
  const orders = db.orders
    .filter(order => order.uid === req.uid)
    .map(({ id, items, total, status, date }) => ({ id, items, total, status, date }))
    .reverse();

  res.json({ orders });
});

app.post('/api/orders', identifyCustomer, (req, res) => {
  const profile = db.profiles[req.uid] || {};
  if (!profile.firstName || !profile.phone || !profile.address) {
    return errorResponse(res, 'Заполните имя, телефон и адрес в профиле');
  }

  const list = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!list.length || list.length > 100) {
    return errorResponse(res, 'Выберите товары для заказа');
  }

  const merged = new Map();
  for (const item of list) {
    const id = Number(item.id);
    const qty = Math.floor(Number(item.qty));
    if (!(id > 0) || !(qty > 0) || qty > 99) {
      return errorResponse(res, 'Неверные данные корзины');
    }
    const size = text(item.size, 8);
    const previous = merged.get(id) || { qty: 0, size: '' };
    if (previous.size && size && previous.size !== size) return errorResponse(res, 'Для одного товара оформите разные размеры отдельными заказами');
    merged.set(id, { qty: previous.qty + qty, size: size || previous.size });
  }

  const items = [];
  let total = 0;

  for (const [id, selection] of merged) {
    const qty = selection.qty;
    const size = selection.size;
    const product = db.products.find(item => item.id === id);
    if (!product) return errorResponse(res, 'Один из товаров больше недоступен');
    if (product.sizes?.length && !product.sizes.includes(size)) return errorResponse(res, 'Выберите размер для «' + product.name + '»');
    if (product.stock < qty) {
      return errorResponse(res, `«${product.name}»: в наличии только ${product.stock} шт.`);
    }

    items.push({
      productId: id,
      name: product.name,
      price: product.price,
      qty,
      image: product.image,
      ...(size ? { size } : {})
    });
    total += product.price * qty;
  }

  for (const item of items) {
    const product = db.products.find(product => product.id === item.productId);
    product.stock -= item.qty;
  }

  const order = {
    id: ++db.orderNo,
    uid: req.uid,
    name: [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(' '),
    phone: profile.phone,
    address: profile.address,
    items,
    total: Math.round(total * 100) / 100,
    status: 'Новый',
    date: new Date().toISOString()
  };

  db.orders.push(order);
  save();
  res.json({ id: order.id, total: order.total });
});

const loginAttempts = new Map();

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return errorResponse(res, 'На сервере не задан ADMIN_PASSWORD', 503);
  }

  const ip = req.ip;
  const attempt = loginAttempts.get(ip) || { count: 0, startedAt: Date.now() };

  if (Date.now() - attempt.startedAt > 15 * 60 * 1000) {
    attempt.count = 0;
    attempt.startedAt = Date.now();
  }

  if (attempt.count >= 10) {
    return errorResponse(res, 'Слишком много попыток. Подождите 15 минут', 429);
  }

  const supplied = hash(req.body?.password);
  const expected = hash(ADMIN_PASSWORD);
  const valid = crypto.timingSafeEqual(supplied, expected);

  if (!valid) {
    attempt.count++;
    loginAttempts.set(ip, attempt);
    return errorResponse(res, 'Неверный пароль', 401);
  }

  loginAttempts.delete(ip);
  res.json({ token: makeAdminToken() });
});

const admin = express.Router();
admin.use(requireAdmin);

admin.get('/stats', (req, res) => {
  const activeOrders = db.orders.filter(order => order.status !== 'Отменён');
  const soldByName = {};

  activeOrders.forEach(order => {
    order.items.forEach(item => {
      soldByName[item.name] = (soldByName[item.name] || 0) + item.qty;
    });
  });

  res.json({
    orders: db.orders.length,
    products: db.products.length,
    customers: new Set([...Object.keys(db.profiles), ...db.orders.map(order => order.uid)]).size,
    active: activeOrders.length,
    revenue: Math.round(activeOrders.reduce((sum, order) => sum + order.total, 0) * 100) / 100,
    items: Object.values(soldByName).reduce((sum, qty) => sum + qty, 0),
    reviews: db.reviews.length,
    top: Object.entries(soldByName)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, qty]) => ({ name, qty }))
  });
});

admin.get('/products', (req, res) => {
  res.json([...db.products].sort((a, b) => b.id - a.id).map(publicProduct));
});

admin.get('/categories', (req, res) => {
  res.json(db.categories);
});

admin.get('/orders', (req, res) => res.json([...db.orders].reverse()));

admin.put('/orders/:id', (req, res) => {
  const order = db.orders.find(item => item.id === Number(req.params.id));
  if (!order) return errorResponse(res, 'Заказ не найден', 404);

  const status = req.body?.status;
  if (!STATUSES.includes(status)) return errorResponse(res, 'Неверный статус');

  if (status === 'Отменён' && order.status !== 'Отменён') {
    order.items.forEach(item => {
      const product = db.products.find(product => product.id === item.productId);
      if (product) product.stock += item.qty;
    });
  }

  if (order.status === 'Отменён' && status !== 'Отменён') {
    const required = order.items.map(item => [
      db.products.find(product => product.id === item.productId),
      item.qty
    ]);

    if (required.some(([product, qty]) => product && product.stock < qty)) {
      return errorResponse(res, 'На складе не хватает товара, чтобы вернуть заказ в работу');
    }

    required.forEach(([product, qty]) => {
      if (product) product.stock -= qty;
    });
  }

  order.status = status;
  save();
  res.json(order);
});

admin.post('/categories', (req, res) => {
  const name = text(req.body?.name, 40);
  if (!name) return errorResponse(res, 'Введите название категории');

  const category = { id: nextId(), name };
  db.categories.push(category);
  save();
  res.json(category);
});

admin.put('/categories/:id', (req, res) => {
  const category = db.categories.find(item => item.id === Number(req.params.id));
  if (!category) return errorResponse(res, 'Категория не найдена', 404);

  const name = text(req.body?.name, 40);
  if (!name) return errorResponse(res, 'Введите название категории');

  category.name = name;
  save();
  res.json(category);
});

admin.delete('/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.categories.some(category => category.id === id)) {
    return errorResponse(res, 'Категория не найдена', 404);
  }
  if (db.products.some(product => product.categoryId === id)) {
    return errorResponse(res, 'В категории есть товары. Сначала перенесите или удалите их');
  }

  db.categories = db.categories.filter(category => category.id !== id);
  save();
  res.json({ ok: true });
});

admin.post('/products', (req, res) => {
  const product = { id: nextId(), ...readProduct(req.body) };
  db.products.push(product);
  save();
  res.json(publicProduct(product));
});

admin.put('/products/:id', (req, res) => {
  const product = db.products.find(item => item.id === Number(req.params.id));
  if (!product) return errorResponse(res, 'Товар не найден', 404);

  Object.assign(product, readProduct(req.body, product));
  save();
  res.json(publicProduct(product));
});

admin.delete('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = db.products.find(item => item.id === id);
  if (!product) return errorResponse(res, 'Товар не найден', 404);

  removeImage(product.image);
  db.products = db.products.filter(item => item.id !== id);
  db.reviews = db.reviews.filter(review => review.productId !== id);
  save();
  res.json({ ok: true });
});

admin.get('/reviews', (req, res) => {
  res.json(
    [...db.reviews]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(review => ({
        id: review.id,
        name: review.name,
        rating: review.rating,
        text: review.text,
        date: review.date,
        product: db.products.find(product => product.id === review.productId)?.name || 'Удалённый товар'
      }))
  );
});

admin.delete('/reviews/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.reviews.some(review => review.id === id)) {
    return errorResponse(res, 'Отзыв не найден', 404);
  }

  db.reviews = db.reviews.filter(review => review.id !== id);
  save();
  res.json({ ok: true });
});

app.use('/api/admin', admin);
app.use('/uploads', express.static(UPLOADS, { maxAge: '30d', immutable: true, index: false }));

const INDEX_FILE = path.join(__dirname, 'index.html');

app.get(['/', '/admin'], (req, res) => {
  res.sendFile(INDEX_FILE, error => {
    if (error && !res.headersSent) {
      console.error('Не удалось открыть index.html:', error);
      res.status(500).send('Не удалось открыть index.html');
    }
  });
});

app.use('/api', (req, res) => errorResponse(res, 'Не найдено', 404));
app.use((req, res) => res.status(404).type('text').send('Страница не найдена'));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = error.status || 500;
  if (status >= 500) console.error(error);

  const message =
    error.type === 'entity.too.large'
      ? 'Файл слишком большой'
      : status < 500
        ? error.message
        : 'Ошибка сервера';

  res.status(status).json({ error: message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HJ PREMIUM MARKET запущен на порту ${PORT}`);
  console.log(`Проверка сервера: /health`);
  console.log(`Данные хранятся в: ${DATA_DIR}`);

  if (!ADMIN_PASSWORD) {
    console.warn('ВНИМАНИЕ: ADMIN_PASSWORD не задан — вход в админку пока невозможен.');
  }
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN не задан — проверка входа Telegram отключена.');
  }
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.DATA_DIR && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.warn('ВНИМАНИЕ: Railway Volume не подключён — данные могут пропасть при новом деплое.');
  }
});
