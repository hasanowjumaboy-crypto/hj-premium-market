import express from 'express';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const BOT_API_SECRET = process.env.BOT_API_SECRET || '';
const BOT_OWNER_ID = String(process.env.BOT_OWNER_ID || '').trim();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CURRENCY_RAW = process.env.CURRENCY || 'TJS';
const CURRENCY = /^(сомони|сомон|tjs|с\.?)$/i.test(String(CURRENCY_RAW).trim()) ? 'TJS' : CURRENCY_RAW;
const DATA_DIR =
  process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(__dirname, 'data');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update('hj-market:' + ADMIN_PASSWORD).digest('hex');

const STATUSES = ['Новый', 'Подтверждён', 'Собирается', 'Собран', 'Отправлен', 'В пути', 'Доставлен', 'Отменён'];
const ADMIN_STATUSES = [...STATUSES.filter(status => status !== 'Отменён'), 'Продано', 'Отменён'];

fs.mkdirSync(UPLOADS, { recursive: true });

const chatTyping = new Map();

const db = {
  seq: 1,
  orderNo: 0,
  categories: [],
  products: [],
  orders: [],
  reviews: [],
  profiles: {},
  carts: {},
  messages: []
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
if (!Array.isArray(db.messages)) db.messages = [];
if (!db.carts || typeof db.carts !== 'object' || Array.isArray(db.carts)) db.carts = {};
if (!Array.isArray(db.botPending)) db.botPending = [];

if (!db.referralPending || typeof db.referralPending !== 'object' || Array.isArray(db.referralPending)) db.referralPending = {};


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

function makeReferralCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}
function ensureReferralCode(profile) {
  if (!profile.referralCode || !/^[A-Z0-9]{8,20}$/.test(String(profile.referralCode))) profile.referralCode = makeReferralCode();
  return profile.referralCode;
}
function profileByReferralCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{8,20}$/.test(normalized)) return null;
  return Object.entries(db.profiles).find(([, profile]) => String(profile?.referralCode || '').toUpperCase() === normalized) || null;
}
function attachReferral(uid, code) {
  const profile = db.profiles[uid];
  if (!profile || profile.referredBy || !code) return false;
  const inviter = profileByReferralCode(code);
  if (!inviter || inviter[0] === uid) return false;
  profile.referredBy = inviter[0];
  profile.referredAt = new Date().toISOString();
  return true;
}
function customerVisibleProfile(profile) {
  const { referredBy, referredAt, telegramId, telegramUsername, ...visible } = profile || {};
  return visible;
}
function publicCustomerProfile(uid, telegram = null, referralCode = '') {
  let profile = db.profiles[uid];
  let changed = false;
  if (!profile) {
    profile = {
      firstName: text(telegram?.first_name, 40),
      lastName: text(telegram?.last_name, 40),
      middleName: '',
      phone: '',
      gender: '',
      age: '',
      address: '',
      photo: '',
      createdAt: new Date().toISOString()
    };
    db.profiles[uid] = profile;
    changed = true;
  }
  if (telegram) {
    if (!profile.firstName && telegram.first_name) { profile.firstName = text(telegram.first_name, 40); changed = true; }
    if (!profile.lastName && telegram.last_name) { profile.lastName = text(telegram.last_name, 40); changed = true; }
    if (telegram.username && profile.telegramUsername !== telegram.username) { profile.telegramUsername = text(telegram.username, 40); changed = true; }
    if (profile.telegramId !== String(telegram.id)) { profile.telegramId = String(telegram.id); changed = true; }
  }
  if (!profile.createdAt) { profile.createdAt = new Date().toISOString(); changed = true; }
  const oldCode = profile.referralCode;
  ensureReferralCode(profile);
  if (oldCode !== profile.referralCode) changed = true;
  if (attachReferral(uid, referralCode)) changed = true;
  if (telegram && db.referralPending[String(telegram.id)]) {
    if (attachReferral(uid, db.referralPending[String(telegram.id)])) changed = true;
    delete db.referralPending[String(telegram.id)];
    changed = true;
  }
  if (changed) save();
  return profile;
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
  const initData = String(req.headers['x-tg-init-data'] || '');
  const telegram = telegramUser(initData);

  if (initData && !telegram) return errorResponse(res, 'Не удалось подтвердить Telegram-аккаунт. Перезапустите магазин через Telegram.', 401);
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
  req.referralCode = text(req.headers['x-referral-code'], 20).toUpperCase();
  next();
}

function identifyChatCustomer(req, res, next) {
  return identifyCustomer(req, res, next);
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
    regularPrice: product.discountPercent ? Number(product.regularPrice) : null,
    discountPercent: product.discountPercent || 0,
    discountReason: product.discountPercent ? (product.discountReason || '') : '',
    stock: product.stock,
    image: product.image,
    photos: Array.isArray(product.photos) && product.photos.length ? product.photos : (product.image ? [product.image] : []),
    rating,
    reviews: reviews.length,
    sizes: product.sizes || [],
    characteristics: product.characteristics && typeof product.characteristics === 'object' && !Array.isArray(product.characteristics) ? product.characteristics : {},
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
  let photos = data.replacePhotos === true
    ? []
    : (Array.isArray(oldProduct?.photos) && oldProduct.photos.length ? [...oldProduct.photos] : (image ? [image] : []));
  const incomingPhotos = Array.isArray(data.photos) ? data.photos : (data.photo ? [data.photo] : []);
  for (const photoData of incomingPhotos.slice(0, 10)) {
    const value = String(photoData || '');
    const savedPhoto = value.startsWith('/uploads/')
      ? (/^\/uploads\/[a-f0-9]+\.(jpg|jpeg|png|webp)$/.test(value) ? value : '')
      : (/^https:\/\/[^\s]+$/i.test(value) ? value : saveImage(value));
    if (!savedPhoto) throw Object.assign(new Error('Некорректная фотография товара'), { status: 400 });
    photos.push(savedPhoto);
  }
  photos = [...new Set(photos)].slice(0, 10);
  image = photos[0] || '';

  return {
    name,
    desc: text(data.desc, 500),
    characteristics: (() => {
      const source = data.characteristics && typeof data.characteristics === 'object' && !Array.isArray(data.characteristics)
        ? data.characteristics
        : (oldProduct?.characteristics || {});
      return Object.fromEntries(Object.entries(source).slice(0, 30).map(([key, value]) => [text(key, 50), text(value, 160)]).filter(([key, value]) => key && value));
    })(),
    price: Math.round(price * 100) / 100,
    stock,
    categoryId,
    image,
    photos
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

app.use(express.json({ limit: '45mb' }));

const TELEGRAM_WEB_APP_URL = 'https://hj-premium-market-production.up.railway.app';
const TELEGRAM_WEBHOOK_URL = TELEGRAM_WEB_APP_URL + '/telegram/webhook';
// Отдельный секрет webhook производим из серверного секрета, токен бота не раскрывается.
const TELEGRAM_WEBHOOK_SECRET = crypto
  .createHmac('sha256', SECRET)
  .update('hj-premium-market-telegram-webhook')
  .digest('hex');

async function telegramApi(method, payload) {
  if (!BOT_TOKEN) throw new Error('Telegram bot token is not configured');
  const response = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    // Не выводим URL запроса: он содержит секретный токен бота.
    throw new Error('Telegram API ' + method + ' failed: ' + text(result.description || response.statusText, 180));
  }
  return result.result;
}

async function configureTelegramBot() {
  if (!BOT_TOKEN) return;
  try {
    await telegramApi('setWebhook', {
      url: TELEGRAM_WEBHOOK_URL,
      secret_token: TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message'],
      drop_pending_updates: false
    });
    await telegramApi('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: '🛍 Магазин',
        web_app: { url: TELEGRAM_WEB_APP_URL }
      }
    });
    console.log('Telegram-бот подключён: webhook и кнопка меню настроены.');
  } catch (error) {
    console.error('Не удалось настроить Telegram-бота:', error.message);
  }
}

async function sendTelegramStart(chatId, firstName = '') {
  const name = text(firstName, 40);
  const greeting = name ? ', ' + name : '';
  return telegramApi('sendMessage', {
    chat_id: chatId,
    text: 'Здравствуйте' + greeting + '! Добро пожаловать в HJ PREMIUM MARKET. Нажмите кнопку ниже, чтобы открыть магазин, посмотреть товары и оформить заказ.',
    reply_markup: {
      inline_keyboard: [[{
        text: '🛍 Открыть магазин',
        web_app: { url: TELEGRAM_WEB_APP_URL }
      }]]
    }
  });
}

// Telegram webhook: отвечает на /start и /help, остальные обновления безопасно подтверждает.
app.post('/telegram/webhook', async (req, res) => {
  const suppliedSecret = String(req.headers['x-telegram-bot-api-secret-token'] || '');
  const expected = Buffer.from(TELEGRAM_WEBHOOK_SECRET);
  const received = Buffer.from(suppliedSecret);
  if (!suppliedSecret || received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return res.sendStatus(401);
  }

  res.sendStatus(200);
  const message = req.body?.message;
  const chatId = message?.chat?.id;
  if (!chatId) return;
  const telegramId = String(message.from?.id || '');
  if (message.contact && telegramId && String(message.contact.user_id || '') === telegramId) {
    const profile = publicCustomerProfile('tg:' + telegramId, message.from || null, '');
    const phone = text(message.contact.phone_number, 20);
    if (phone) { profile.phone = phone; save(); }
    return;
  }
  const parts = String(message?.text || '').trim().split(/\s+/);
  const command = String(parts[0] || '').split('@')[0].toLowerCase();
  const startPayload = command === '/start' ? String(parts[1] || '') : '';

  if (command === '/start' || command === '/start@hj_premium_market_bot') {
    if (/^ref_[A-Z0-9]{8,20}$/i.test(startPayload)) {
      db.referralPending[telegramId] = startPayload.slice(4).toUpperCase();
      save();
    }
    try {
      await sendTelegramStart(chatId, message.from?.first_name || '');
    } catch (error) {
      console.error('Не удалось отправить приветствие Telegram:', error.message);
    }
  } else if (command === '/help') {
    try {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: 'Чтобы перейти к товарам и заказам, нажмите «Открыть магазин» внизу чата или кнопку ниже.',
        reply_markup: {
          inline_keyboard: [[{
            text: '🛍 Открыть магазин',
            web_app: { url: TELEGRAM_WEB_APP_URL }
          }]]
        }
      });
    } catch (error) {
      console.error('Не удалось отправить помощь Telegram:', error.message);
    }
  }
});

// Проверка состояния сервера
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'HJ PREMIUM MARKET' });
});

app.get('/api/config', (req, res) => {
  res.json({ currency: CURRENCY, statuses: STATUSES, telegram: Boolean(BOT_TOKEN) });
});

app.get('/api/categories', (req, res) => res.json(db.categories));

app.get('/api/products', (req, res) => {
  res.json([...db.products].filter(product => product.published !== false).sort((a, b) => b.id - a.id).map(publicProduct));
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

  const orderId = Number(req.body?.orderId);
  const order = db.orders.find(item => item.id === orderId && item.uid === req.uid && item.status === 'Доставлен' && (item.items || []).some(orderedItem => orderedItem.productId === product.id));
  if (!order) return errorResponse(res, 'Оставить отзыв можно только на товар из доставленного заказа');
  const orderedItem = order.items.find(item => item.productId === product.id);
  const reviewText = text(req.body?.text, 500);
  const name = customerName(req);
  const date = new Date().toISOString();
  const reviewData = {
    orderId: order.id,
    productName: orderedItem.name || product.name,
    productImage: orderedItem.image || product.image || '',
    productPhotos: Array.isArray(orderedItem.photos) && orderedItem.photos.length ? orderedItem.photos : (orderedItem.image || product.image ? [orderedItem.image || product.image] : []),
    productDesc: orderedItem.desc || product.desc || '',
    productPrice: orderedItem.price ?? product.price,
    buyerName: order.name || name
  };
  const existing = db.reviews.find(review => review.productId === product.id && review.uid === req.uid);
  if (existing) Object.assign(existing, reviewData, { rating, text: reviewText, name, date });
  else db.reviews.push({ id: nextId(), productId: product.id, uid: req.uid, ...reviewData, rating, text: reviewText, name, date });

  save();
  res.json({ ok: true });
});

app.get('/api/cart', identifyCustomer, (req, res) => {
  const cart = db.carts[req.uid] || { items: {}, selected: [], sizes: {} };
  res.json({ items: cart.items || {}, selected: cart.selected || [], sizes: cart.sizes || {} });
});

app.put('/api/cart', identifyCustomer, (req, res) => {
  const body = req.body || {};
  const incoming = body.items && typeof body.items === 'object' && !Array.isArray(body.items) ? body.items : {};
  const items = {};
  for (const [rawId, rawQty] of Object.entries(incoming)) {
    const product = db.products.find(item => String(item.id) === String(rawId));
    const qty = Math.floor(Number(rawQty));
    if (!product || !Number.isFinite(qty) || qty < 1 || product.stock < 1) continue;
    items[String(product.id)] = Math.min(qty, Number(product.stock));
  }
  const selected = Array.isArray(body.selected) ? [...new Set(body.selected.map(String))].filter(id => Object.prototype.hasOwnProperty.call(items, id)) : Object.keys(items);
  const incomingSizes = body.sizes && typeof body.sizes === 'object' && !Array.isArray(body.sizes) ? body.sizes : {};
  const sizes = {};
  for (const [id, size] of Object.entries(incomingSizes)) {
    const product = db.products.find(item => String(item.id) === id);
    if (items[id] && product && Array.isArray(product.sizes) && product.sizes.map(String).includes(String(size))) sizes[id] = String(size);
  }
  db.carts[req.uid] = { items, selected, sizes, updatedAt: new Date().toISOString() };
  save();
  res.json({ ok: true, items, selected, sizes });
});

app.get('/api/profile', identifyCustomer, (req, res) => {
  const profile = publicCustomerProfile(req.uid, req.telegram || null, req.referralCode || '');
  res.json({ profile: customerVisibleProfile(profile), via: req.telegram ? 'telegram' : 'web' });
});

app.put('/api/profile', identifyCustomer, (req, res) => {
  const body = req.body || {};
  const old = db.profiles[req.uid] || {};
  const firstName = body.firstName !== undefined
    ? text(body.firstName, 40)
    : (old.firstName || text(req.telegram?.first_name, 40));
  const phone = body.phone !== undefined ? text(body.phone, 20) : (old.phone || '');
  const gender = body.gender !== undefined ? text(body.gender, 20) : (old.gender || '');
  const age = body.age !== undefined && body.age !== '' ? Number(body.age) : (old.age ?? '');

  if (body.firstName !== undefined && !firstName) return errorResponse(res, 'Укажите имя');
  if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) return errorResponse(res, 'Неверный номер телефона');
  if (gender && !['Мужской', 'Женский'].includes(gender)) return errorResponse(res, 'Укажите пол');
  if (age !== '' && (!Number.isInteger(age) || age < 1 || age > 120)) return errorResponse(res, 'Укажите корректный возраст');

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
    ...old,
    firstName,
    lastName: body.lastName !== undefined ? text(body.lastName, 40) : (old.lastName || ''),
    middleName: body.middleName !== undefined ? text(body.middleName, 40) : (old.middleName || ''),
    phone,
    gender,
    age,
    address: body.address !== undefined ? text(body.address, 300) : (old.address || ''),
    photo,
    createdAt: old.createdAt || new Date().toISOString()
  };
  ensureReferralCode(db.profiles[req.uid]);
  save();
  res.json(customerVisibleProfile(db.profiles[req.uid]));
});

// Переписка покупателя с магазином.
app.get('/api/chat', identifyChatCustomer, (req, res) => {
  const chat = db.messages.find(item => item.uid === req.uid);
  if (chat) {
    (chat.messages || []).forEach(message => {
      if (message.sender === 'admin') message.readByCustomer = true;
    });
    save();
  }
  const messages=(chat?.messages||[]).filter(m=>!m.deletedForEveryone&&!(m.hiddenFor||[]).includes('customer')).map(message=>{if(message.orderContextNotice&&message.orderId){const order=db.orders.find(o=>String(o.id)===String(message.orderId)&&o.uid===req.uid);return {...message,orderDetails:order?{...order,items:(Array.isArray(order.items)?order.items:[]).map(item=>({...item}))}:null};}return message;});res.json({messages,subject:chat?.subject||''});
});
app.post('/api/chat/order-context', identifyCustomer, (req,res)=>{const order=db.orders.find(o=>String(o.id)===String(req.body?.orderId)&&o.uid===req.uid);if(!order)return errorResponse(res,'Заказ не найден',404);let chat=db.messages.find(item=>item.uid===req.uid);if(!chat){chat={uid:req.uid,subject:'Заказ №'+order.id,createdAt:new Date().toISOString(),messages:[]};db.messages.push(chat);}chat.hiddenForAdmin=false;chat.messages=Array.isArray(chat.messages)?chat.messages:[];const products=(order.items||[]).map(i=>(i.name||'Товар')+' × '+Number(i.qty||1)+(i.size?' (размер '+i.size+')':'')).join('; ');const messageText='📦 Покупатель обратился по заказу №'+order.id+'.\nТовары: '+(products||'см. состав заказа')+'.';const message={id:nextId(),uid:req.uid,sender:'customer',text:messageText,image:'',date:new Date().toISOString(),readByAdmin:false,orderId:order.id,orderContextNotice:true};chat.messages.push(message);chat.lastMessage=message.date;chat.lastText=messageText;save();res.json({ok:true,orderId:order.id});});
app.get('/api/chat/typing', identifyChatCustomer, (req,res)=>{const t=chatTyping.get(req.uid)||{};res.json({typing:Boolean(t.admin&&Date.now()-t.admin<2800)});});
app.post('/api/chat/typing', identifyChatCustomer, (req,res)=>{const t=chatTyping.get(req.uid)||{};if(req.body?.typing===true)t.customer=Date.now();else delete t.customer;chatTyping.set(req.uid,t);res.json({ok:true});});
app.post('/api/chat', identifyChatCustomer, (req, res) => {
  const body = req.body || {}; const messageText = text(body.text, 2000);
  let image = ''; if (body.image) image = saveImage(body.image);
  if (!messageText && !image) return errorResponse(res, 'Напишите сообщение или прикрепите фото');
  let chat = db.messages.find(item => item.uid === req.uid);
  if (!chat) { chat = { uid: req.uid, subject: text(body.subject, 80) || 'Общий вопрос', createdAt: new Date().toISOString(), messages: [] }; db.messages.push(chat); } chat.hiddenForAdmin=false;
  const message = { id: nextId(), uid: req.uid, sender: 'customer', text: messageText, image, date: new Date().toISOString(), readByAdmin: false };
  chat.messages = Array.isArray(chat.messages) ? chat.messages : []; chat.messages.push(message); chat.lastMessage = message.date; chat.lastText = messageText || 'Фото';
  save(); res.json({ ok: true, message, subject: chat.subject });
});

app.patch('/api/chat/:messageId',identifyChatCustomer,(req,res)=>{const chat=db.messages.find(x=>x.uid===req.uid),m=chat?.messages?.find(x=>String(x.id)===String(req.params.messageId));if(!m)return errorResponse(res,'Сообщение не найдено',404);if(m.sender!=='customer')return errorResponse(res,'Можно редактировать только своё сообщение',403);if(m.deletedForEveryone)return errorResponse(res,'Сообщение уже удалено');const value=text(req.body?.text,2000);if(!value&&!m.image)return errorResponse(res,'Сообщение не может быть пустым');m.text=value;m.editedAt=new Date().toISOString();save();res.json({ok:true,message:m});});
app.delete('/api/chat/:messageId',identifyChatCustomer,(req,res)=>{const chat=db.messages.find(x=>x.uid===req.uid),m=chat?.messages?.find(x=>String(x.id)===String(req.params.messageId));if(!m)return errorResponse(res,'Сообщение не найдено',404);if(req.body?.forEveryone===true&&m.sender!=='customer')return errorResponse(res,'Удалить у всех может только автор сообщения',403);if(req.body?.forEveryone===true){if(m.image)removeImage(m.image);chat.messages.splice(chat.messages.indexOf(m),1);}else{m.hiddenFor=Array.isArray(m.hiddenFor)?m.hiddenFor:[];if(!m.hiddenFor.includes('customer'))m.hiddenFor.push('customer');}save();res.json({ok:true});});

app.get('/api/orders', identifyCustomer, (req, res) => {
  const orders = db.orders
    .filter(order => order.uid === req.uid && !order.hiddenForCustomer)
    .map(order => ({
      id: order.id,
      items: (order.items || []).map(item => ({ ...item, reviewed: db.reviews.some(review => review.uid === req.uid && review.productId === item.productId) })),
      total: order.total,
      status: order.status === 'Продано' ? (order.customerStatus || 'Доставлен') : order.status,
      cancelReason: order.cancelReason || '',
      cancelledBy: order.cancelledBy || '',
      cancelledAt: order.cancelledAt || '',
      date: order.date,
      phone: order.phone,
      address: order.address,
      cancelUntil: new Date(new Date(order.date).getTime() + 60 * 60 * 1000).toISOString(),
      canCancel: order.status === 'Новый' && Date.now() <= new Date(order.date).getTime() + 60 * 60 * 1000
    }))
    .reverse();

  res.json({ orders });
});

app.post('/api/orders/:id/cancel', identifyCustomer, (req, res) => {
  const order = db.orders.find(item => item.id === Number(req.params.id) && item.uid === req.uid);
  if (!order) return errorResponse(res, 'Заказ не найден', 404);
  if (order.status === 'Отменён') return errorResponse(res, 'Заказ уже отменён');
  const createdAt = new Date(order.date).getTime();
  if (!Number.isFinite(createdAt) || Date.now() > createdAt + 60 * 60 * 1000) {
    return errorResponse(res, 'Время отмены заказа (1 час) истекло');
  }
  if (order.status !== 'Новый') return errorResponse(res, 'Заказ уже принят в обработку. Свяжитесь с магазином для отмены');
  const cancelReason = text(req.body?.cancelReason, 300);
  if (!cancelReason) return errorResponse(res, 'Укажите причину отмены заказа');
  for (const item of order.items) {
    const product = db.products.find(product => product.id === item.productId);
    if (product) product.stock += item.qty;
  }
  order.status = 'Отменён';
  order.cancelReason = cancelReason;
  order.cancelledAt = new Date().toISOString();
  order.cancelledBy = 'Покупатель';
  order.stockRestoredOnCancel = true;
  save();
  res.json({ ok: true, order });
});

app.delete('/api/orders/:id', identifyCustomer, (req, res) => {
  const order = db.orders.find(item => item.id === Number(req.params.id) && item.uid === req.uid);
  if (!order) return errorResponse(res, 'Заказ не найден', 404);
  if (order.status !== 'Отменён') return errorResponse(res, 'Удалять можно только отменённые заказы', 400);
  order.hiddenForCustomer = true;
  save();
  res.json({ ok: true, id: order.id });
});

app.post('/api/orders', identifyCustomer, (req, res) => {
  const profile = db.profiles[req.uid] || {};
  if (!profile.phone || !profile.address) {
    return errorResponse(res, 'Укажите телефон и адрес доставки');
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
      photos: Array.isArray(product.photos) && product.photos.length ? product.photos : (product.image ? [product.image] : []),
      desc: product.desc || '',
      categoryId: product.categoryId,
      sizes: product.sizes || [],
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
    name: [profile.lastName, profile.firstName || text(req.telegram?.first_name, 40) || 'Покупатель', profile.middleName].filter(Boolean).join(' '),
    phone: profile.phone,
    gender: profile.gender,
    age: profile.age,
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

const passkeyChallenges = new Map();
function webauthnOrigin(req) { return `${req.protocol}://${req.get('host')}`; }
function webauthnRpId(req) { return process.env.WEBAUTHN_RP_ID || req.hostname; }
function rememberPasskeyChallenge(challenge, purpose) {
  passkeyChallenges.set(challenge, { purpose, expires: Date.now() + 5 * 60 * 1000 });
}
function takePasskeyChallenge(challenge, purpose) {
  const saved = passkeyChallenges.get(String(challenge || ''));
  passkeyChallenges.delete(String(challenge || ''));
  return saved && saved.purpose === purpose && saved.expires > Date.now() ? saved : null;
}

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

app.get('/api/admin/passkey/status', (req, res) => {
  res.json({ available: Boolean(db.adminPasskey?.id), rpId: webauthnRpId(req) });
});

app.post('/api/admin/passkey/register/options', requireAdmin, async (req, res) => {
  try {
    const options = await generateRegistrationOptions({
      rpName: 'HJ PREMIUM MARKET',
      rpID: webauthnRpId(req),
      userID: crypto.randomBytes(16),
      userName: 'owner',
      userDisplayName: 'Владелец HJ PREMIUM MARKET',
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required'
      },
      excludeCredentials: db.adminPasskey?.id ? [{
        id: db.adminPasskey.id,
        transports: db.adminPasskey.transports || []
      }] : []
    });
    rememberPasskeyChallenge(options.challenge, 'register');
    res.json(options);
  } catch (error) {
    console.error('Passkey registration options:', error);
    errorResponse(res, 'Не удалось подготовить настройку биометрии', 500);
  }
});

app.post('/api/admin/passkey/register/verify', requireAdmin, async (req, res) => {
  try {
    const challenge = req.body?.response?.response?.clientDataJSON
      ? JSON.parse(Buffer.from(req.body.response.response.clientDataJSON, 'base64url').toString()).challenge
      : '';
    if (!takePasskeyChallenge(challenge, 'register')) return errorResponse(res, 'Время настройки истекло. Повторите попытку', 400);
    const verification = await verifyRegistrationResponse({
      response: req.body.response,
      expectedChallenge: challenge,
      expectedOrigin: webauthnOrigin(req),
      expectedRPID: webauthnRpId(req),
      requireUserVerification: true
    });
    if (!verification.verified || !verification.registrationInfo) return errorResponse(res, 'Телефон не подтвердил биометрию', 400);
    const credential = verification.registrationInfo.credential;
    db.adminPasskey = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports || []
    };
    save();
    res.json({ ok: true });
  } catch (error) {
    console.error('Passkey registration verification:', error);
    errorResponse(res, 'Не удалось сохранить биометрический ключ. Попробуйте ещё раз', 400);
  }
});

app.post('/api/admin/passkey/auth/options', async (req, res) => {
  if (!db.adminPasskey?.id) return errorResponse(res, 'Вход по отпечатку ещё не настроен', 404);
  try {
    const options = await generateAuthenticationOptions({
      rpID: webauthnRpId(req),
      allowCredentials: [{
        id: db.adminPasskey.id,
        transports: db.adminPasskey.transports || []
      }],
      userVerification: 'required'
    });
    rememberPasskeyChallenge(options.challenge, 'authenticate');
    res.json(options);
  } catch (error) {
    console.error('Passkey authentication options:', error);
    errorResponse(res, 'Не удалось подготовить вход по биометрии', 500);
  }
});

app.post('/api/admin/passkey/auth/verify', async (req, res) => {
  try {
    if (!db.adminPasskey?.id) return errorResponse(res, 'Вход по отпечатку ещё не настроен', 404);
    const challenge = req.body?.response?.response?.clientDataJSON
      ? JSON.parse(Buffer.from(req.body.response.response.clientDataJSON, 'base64url').toString()).challenge
      : '';
    if (!takePasskeyChallenge(challenge, 'authenticate')) return errorResponse(res, 'Время входа истекло. Попробуйте ещё раз', 400);
    const stored = db.adminPasskey;
    const verification = await verifyAuthenticationResponse({
      response: req.body.response,
      expectedChallenge: challenge,
      expectedOrigin: webauthnOrigin(req),
      expectedRPID: webauthnRpId(req),
      credential: {
        id: stored.id,
        publicKey: Buffer.from(stored.publicKey, 'base64url'),
        counter: stored.counter,
        transports: stored.transports || []
      },
      requireUserVerification: true
    });
    if (!verification.verified) return errorResponse(res, 'Отпечаток не подтверждён', 401);
    stored.counter = verification.authenticationInfo.newCounter;
    save();
    res.json({ token: makeAdminToken() });
  } catch (error) {
    console.error('Passkey authentication verification:', error);
    errorResponse(res, 'Не удалось подтвердить вход по отпечатку', 401);
  }
});


function requireBotApi(req, res, next) {
  const supplied = String(req.get('x-hj-bot-secret') || '');
  const suppliedOwner = String(req.get('x-hj-owner-id') || '').trim();
  if (!BOT_API_SECRET || !/^[0-9]+$/.test(BOT_OWNER_ID)) return errorResponse(res, 'Bot API is not configured', 503);
  const a = Buffer.from(supplied);
  const expected = Buffer.from(BOT_API_SECRET);
  if (a.length !== expected.length || !crypto.timingSafeEqual(a, expected)) {
    return errorResponse(res, 'Forbidden', 403);
  }
  if (suppliedOwner !== BOT_OWNER_ID) return errorResponse(res, 'Forbidden', 403);
  next();
}


function botProduct(id) { return db.products.find(item => item.id === Number(id)); }
function botOrder(id) { return db.orders.find(item => item.id === Number(id)); }
function botCodeHash(code, pendingId, ownerId) {
  return crypto.createHmac('sha256', BOT_API_SECRET)
    .update([String(ownerId), String(pendingId), String(code)].join(':')).digest('hex');
}
function cleanBotPending() {
  const now = Date.now();
  db.botPending = db.botPending.filter(item => item.expiresAt > now && item.attempts < 5 && !item.usedAt);
}
function botPreview(action) {
  if (!action || typeof action !== 'object') throw Object.assign(new Error('Не указано действие'), {status:400});
  if (action.type === 'update_price' || action.type === 'update_stock') {
    const p = botProduct(action.productId);
    if (!p) throw Object.assign(new Error('Товар не найден'), {status:404});
    const key = action.type === 'update_price' ? 'price' : 'stock';
    const value = Number(action.value);
    if (!Number.isFinite(value) || value < 0 || (key === 'stock' && (!Number.isInteger(value) || value > 1000000)) || (key === 'price' && value > 1e9))
      throw Object.assign(new Error('Некорректное новое значение'), {status:400});
    return {action:{type:action.type,productId:p.id,value}, preview:{title:action.type==='update_price'?'Изменение цены':'Изменение остатка', target:p.name, oldValue:p[key], newValue:key==='price'?Math.round(value*100)/100:value}};
  }
  if (action.type === 'update_order_status' || action.type === 'cancel_order') {
    const o = botOrder(action.orderId);
    if (!o) throw Object.assign(new Error('Заказ не найден'), {status:404});
    const status = action.type === 'cancel_order' ? 'Отменён' : text(action.status,30);
    if (!ADMIN_STATUSES.includes(status)) throw Object.assign(new Error('Недопустимый статус заказа'), {status:400});
    if (o.status === status) throw Object.assign(new Error('Заказ уже имеет этот статус'), {status:400});
    return {action:{type:'update_order_status',orderId:o.id,status}, preview:{title:status==='Отменён'?'Отмена заказа':'Изменение статуса заказа',target:'Заказ №'+o.id,oldValue:o.status,newValue:status,total:o.total}};
  }
  if (action.type === 'set_discount') {
    const p = botProduct(action.productId);
    const percent = Number(action.percent);
    if (!p) throw Object.assign(new Error('Товар не найден'), {status:404});
    if (!Number.isInteger(percent) || percent < 1 || percent > 90) throw Object.assign(new Error('Скидка должна быть от 1 до 90 процентов'), {status:400});
    const basePrice = Number(p.regularPrice ?? p.price);
    const discounted = Math.round(basePrice * (1 - percent / 100) * 100) / 100;
    const reason = String(action.reason || '').trim().slice(0,100);
    return {action:{type:'set_discount',productId:p.id,percent,reason},preview:{title:'Включение скидки',target:p.name,oldValue:p.price,newValue:discounted,percent,reason}};
  }
  if (action.type === 'bulk_disable_discount') {
    const ids = [...new Set((Array.isArray(action.productIds) ? action.productIds : []).map(Number))];
    if (!ids.length || ids.length > 100) throw Object.assign(new Error('Укажите от 1 до 100 товаров'), {status:400});
    const products = ids.map(botProduct);
    if (products.some(p => !p)) throw Object.assign(new Error('Один из товаров не найден'), {status:404});
    const eligible = products.filter(p => p.discountPercent && Number.isFinite(Number(p.regularPrice)));
    if (!eligible.length) throw Object.assign(new Error('У выбранных товаров нет активных скидок'), {status:400});
    return {action:{type:'bulk_disable_discount',productIds:eligible.map(p=>p.id),expected:eligible.map(p=>({id:p.id,price:p.price,regularPrice:Number(p.regularPrice)}))},preview:{title:'Отключение скидок',target:eligible.map(p=>p.name).join(', '),count:eligible.length,products:eligible.map(p=>({id:p.id,name:p.name,oldPrice:p.price,newPrice:Number(p.regularPrice)}))}};
  }
  if (action.type === 'disable_discount') {
    const p = botProduct(action.productId);
    if (!p) throw Object.assign(new Error('Товар не найден'), {status:404});
    if (!p.discountPercent || !Number.isFinite(Number(p.regularPrice))) throw Object.assign(new Error('У этого товара нет активной скидки'), {status:400});
    return {action:{type:'disable_discount',productId:p.id},preview:{title:'Отключение скидки',target:p.name,oldValue:p.price,newValue:p.regularPrice}};
  }
  if (action.type === 'update_product') {
    const p = botProduct(action.productId);
    if (!p) throw Object.assign(new Error('Товар не найден'), {status:404});
    const merged = {
      name: action.product?.name ?? p.name,
      desc: action.product?.desc ?? p.desc,
      price: action.product?.price ?? p.price,
      stock: action.product?.stock ?? p.stock,
      categoryId: action.product?.categoryId ?? p.categoryId,
      photos: action.product?.photos,
      replacePhotos: action.product?.replacePhotos === true
    };
    const productData = readProduct(merged, p);
    return {action:{type:'update_product',productId:p.id,product:productData,expected:{name:p.name,desc:p.desc,price:p.price,stock:p.stock,categoryId:p.categoryId,image:p.image,photos:JSON.stringify(p.photos||[])}},preview:{title:'Изменение карточки товара',target:p.name+' → '+productData.name,oldValue:p.price,newValue:productData.price,stock:productData.stock,category:db.categories.find(x=>x.id===productData.categoryId)?.name||'',photos:productData.photos.length}};
  }
  if (action.type === 'create_product') {
    const productData = readProduct(action.product || {});
    return {action:{type:'create_product',product:productData},preview:{title:'Добавление товара',target:productData.name,price:productData.price,stock:productData.stock,category:db.categories.find(x=>x.id===productData.categoryId)?.name||'',photos:productData.photos.length}};
  }
  throw Object.assign(new Error('Это действие пока не поддерживается'), {status:400});
}
function applyBotAction(action) {
  if (action.type === 'update_price' || action.type === 'update_stock') {
    const p = botProduct(action.productId);
    if (!p) throw Object.assign(new Error('Товар больше не найден'), {status:404});
    const key = action.type === 'update_price' ? 'price' : 'stock';
    p[key] = action.value;
    if (key === 'price') { delete p.regularPrice; delete p.discountPercent; }
    save();
    return {ok:true, message:key==='price'?'Цена изменена':'Остаток изменён', product:publicProduct(p)};
  }
  if (action.type === 'update_order_status') {
    const order = botOrder(action.orderId);
    if (!order) throw Object.assign(new Error('Заказ больше не найден'), {status:404});
    const status = action.status;
    const wasCancelled = order.status === 'Отменён';
    const willBeCancelled = status === 'Отменён';
    if (willBeCancelled && !wasCancelled) {
      const canReturnToStock = !['Отправлен','В пути','Доставлен'].includes(order.status);
      if (canReturnToStock) for (const item of order.items || []) {
        const product = botProduct(item.productId); if (product) product.stock += Number(item.qty || 0);
      }
      order.stockRestoredOnCancel = canReturnToStock;
    }
    if (wasCancelled && !willBeCancelled && order.stockRestoredOnCancel !== false) {
      const required=(order.items||[]).map(item=>[botProduct(item.productId),Number(item.qty||0)]);
      if(required.some(([product,qty])=>!product||product.stock<qty))
        throw Object.assign(new Error('Недостаточно товара на складе для восстановления заказа'),{status:409});
      required.forEach(([product,qty])=>{product.stock-=qty;});
      order.stockRestoredOnCancel=false;
    }
    if (order.status !== status) { const changedAt = new Date().toISOString(); order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [{status: order.status || 'Новый', at: order.date || changedAt}]; order.statusHistory.push({status, at: changedAt}); if (status === 'Продано') { order.customerStatus = order.status === 'Продано' ? (order.customerStatus || 'Доставлен') : (order.status || 'Доставлен'); order.soldAt = changedAt; } else { order.customerStatus = ''; order.soldAt = ''; } }
    order.status=status;
    if(willBeCancelled){order.cancelReason='Отменён владельцем';order.cancelledAt=order.cancelledAt||new Date().toISOString();order.cancelledBy='Администратор';}
    else {order.cancelReason='';order.cancelledAt='';order.cancelledBy='';}
    save();
    return {ok:true,message:'Статус заказа изменён',order:{id:order.id,status:order.status,total:order.total}};
  }
  if (action.type === 'set_discount') {
    const p=botProduct(action.productId);
    if (!p) throw Object.assign(new Error('Товар больше не найден'),{status:404});
    const basePrice=Number(p.regularPrice ?? p.price);
    p.regularPrice=basePrice;
    p.discountPercent=action.percent;
    p.discountReason=String(action.reason || '').trim().slice(0,100);
    p.price=Math.round(basePrice*(1-action.percent/100)*100)/100;
    save();
    return {ok:true,message:'Скидка включена',product:publicProduct(p)};
  }
  if (action.type === 'bulk_disable_discount') {
    const changed=[];
    for (const id of action.productIds || []) {
      const p=botProduct(id);
      if (!p || !p.discountPercent || !Number.isFinite(Number(p.regularPrice))) throw Object.assign(new Error('Состояние одного из товаров изменилось. Подготовьте действие заново'),{status:409});
      p.price=Number(p.regularPrice); delete p.regularPrice; delete p.discountPercent; delete p.discountReason;
      changed.push(p.name);
    }
    save();
    return {ok:true,message:'Скидки отключены у '+changed.length+' товаров',products:changed};
  }
  if (action.type === 'disable_discount') {
    const p=botProduct(action.productId);
    if (!p || !p.discountPercent || !Number.isFinite(Number(p.regularPrice))) throw Object.assign(new Error('Активная скидка не найдена'),{status:409});
    p.price=Number(p.regularPrice);
    delete p.regularPrice;
    delete p.discountPercent;
    delete p.discountReason;
    save();
    return {ok:true,message:'Скидка отключена',product:publicProduct(p)};
  }
  if (action.type === 'update_product') {
    const p=botProduct(action.productId);
    if(!p) throw Object.assign(new Error('Товар больше не найден'),{status:404});
    const previousPhotos=Array.isArray(p.photos)?p.photos:(p.image?[p.image]:[]);
    Object.assign(p,action.product);
    for(const oldPhoto of previousPhotos) if(!p.photos.includes(oldPhoto)) removeImage(oldPhoto);
    save();
    return {ok:true,message:'Карточка товара обновлена',product:publicProduct(p)};
  }
  if (action.type === 'create_product') {
    const product={id:nextId(),...action.product};
    db.products.push(product); save();
    return {ok:true,message:'Товар добавлен',product:publicProduct(product)};
  }
  throw Object.assign(new Error('Неизвестное действие'),{status:400});
}
app.get('/api/bot/catalog', requireBotApi, (req,res) => {
  res.json({categories:db.categories.map(x=>({id:x.id,name:x.name})),products:db.products.map(p=>({id:p.id,name:p.name,price:p.price,regularPrice:p.discountPercent?Number(p.regularPrice):null,discountPercent:Number(p.discountPercent)||0,discountReason:p.discountPercent?(p.discountReason||''):'',stock:p.stock,categoryId:p.categoryId,category:db.categories.find(x=>x.id===p.categoryId)?.name||''})),orders:db.orders.slice(-100).reverse().map(o=>({id:o.id,status:o.status,total:o.total,date:o.date,items:(o.items||[]).map(i=>({name:i.name,qty:i.qty}))})),statuses:ADMIN_STATUSES});
});
app.post('/api/bot/prepare', requireBotApi, (req,res) => {
  try {
    cleanBotPending();
    const ownerId=String(req.get('x-hj-owner-id')||'');
    const {action,preview}=botPreview(req.body?.action);
    const pendingId=crypto.randomBytes(16).toString('hex');
    const code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
    db.botPending = db.botPending.filter(item => item.ownerId !== ownerId || item.usedAt);
    db.botPending.push({id:pendingId,ownerId,action,preview,codeHash:botCodeHash(code,pendingId,ownerId),createdAt:Date.now(),expiresAt:Date.now()+5*60*1000,attempts:0});
    db.botPending=db.botPending.slice(-20);
    save();
    res.json({pendingId,code,preview,expiresInSeconds:300});
  } catch(error) { errorResponse(res,error.message||'Не удалось подготовить действие',error.status||400); }
});
app.post('/api/bot/confirm', requireBotApi, (req,res) => {
  cleanBotPending();
  const ownerId=String(req.get('x-hj-owner-id')||'');
  const pending=[...db.botPending].reverse().find(x=>x.ownerId===ownerId&&!x.usedAt);
  if(!pending) return errorResponse(res,'Подтверждение не найдено или срок истёк',404);
  const code=String(req.body?.code||'');
  if(!/^\d{6}$/.test(code)||!crypto.timingSafeEqual(Buffer.from(botCodeHash(code,pending.id,ownerId)),Buffer.from(pending.codeHash))) {
    pending.attempts=(pending.attempts||0)+1; if(pending.attempts>=5) pending.usedAt=Date.now(); save();
    return errorResponse(res,'Неверный код. Осталось попыток: '+Math.max(0,5-pending.attempts),401);
  }
  try {
    // Re-check that the target still has the exact state shown in the preview.
    if(pending.action.type==='update_price'||pending.action.type==='update_stock') {
      const p=botProduct(pending.action.productId), key=pending.action.type==='update_price'?'price':'stock';
      if(!p||p[key]!==pending.preview.oldValue) return errorResponse(res,'Данные товара изменились. Подготовьте действие заново',409);
    }
    if(pending.action.type==='update_order_status') {
      const o=botOrder(pending.action.orderId);
      if(!o||o.status!==pending.preview.oldValue) return errorResponse(res,'Статус заказа изменился. Подготовьте действие заново',409);
    }
    if(pending.action.type==='bulk_disable_discount') {
      for (const expected of pending.action.expected || []) {
        const p=botProduct(expected.id);
        if(!p || p.price!==expected.price || Number(p.regularPrice)!==expected.regularPrice) return errorResponse(res,'Данные одного из товаров изменились. Подготовьте действие заново',409);
      }
    }
    if(pending.action.type==='set_discount'||pending.action.type==='disable_discount') {
      const p=botProduct(pending.action.productId);
      if(!p||p.price!==pending.preview.oldValue) return errorResponse(res,'Цена товара изменилась. Подготовьте действие заново',409);
    }
    if(pending.action.type==='update_product') {
      const p=botProduct(pending.action.productId), e=pending.action.expected||{};
      if(!p || p.name!==e.name || p.desc!==e.desc || p.price!==e.price || p.stock!==e.stock || p.categoryId!==e.categoryId || p.image!==e.image || JSON.stringify(p.photos||[])!==e.photos)
        return errorResponse(res,'Карточка товара изменилась. Подготовьте действие заново',409);
    }
    const result=applyBotAction(pending.action);
    pending.usedAt=Date.now(); save();
    res.json(result);
  } catch(error) { errorResponse(res,error.message||'Не удалось выполнить действие',error.status||400); }
});

app.get('/api/bot/overview', requireBotApi, (req, res) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const moscowDate = value => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(value));
    const part = type => parts.find(item => item.type === type)?.value || '';
    return part('year') + '-' + part('month') + '-' + part('day');
  };
  const localToday = moscowDate(new Date());
  const date = datePattern.test(String(req.query.date || '')) ? String(req.query.date) : localToday;
  const ordersToday = db.orders.filter(order => order.date && moscowDate(order.date) === date);
  const delivered = ordersToday.filter(order => order.status === 'Доставлен');
  const cancelled = ordersToday.filter(order => order.status === 'Отменён');
  const active = ordersToday.filter(order => order.status !== 'Отменён');
  const sum = rows => Math.round(rows.reduce((total, order) => total + Number(order.total || 0), 0) * 100) / 100;
  const sold = new Map();
  for (const order of delivered) {
    for (const item of (Array.isArray(order.items) ? order.items : [])) {
      const key = String(item.productId || item.name || 'unknown');
      const row = sold.get(key) || { productId: item.productId || null, name: item.name || 'Товар', qty: 0, revenue: 0 };
      const qty = Math.max(0, Number(item.qty) || 0);
      row.qty += qty;
      row.revenue += Math.max(0, Number(item.price) || 0) * qty;
      sold.set(key, row);
    }
  }
  const topProducts = [...sold.values()]
    .map(row => ({ ...row, revenue: Math.round(row.revenue * 100) / 100 }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const products = db.products.map(product => ({
    id: product.id, name: product.name, price: product.price,
    regularPrice: product.discountPercent ? Number(product.regularPrice) : null,
    discountPercent: Number(product.discountPercent) || 0,
    discountReason: product.discountPercent ? (product.discountReason || '') : '',
    isDiscounted: Number(product.discountPercent) > 0 && Number(product.regularPrice) > Number(product.price),
    stock: product.stock, category: db.categories.find(c => c.id === product.categoryId)?.name || '',
    sold: soldCount(product.id)
  }));
  const discountedProducts = products.filter(product => product.isDiscounted);
  const discountSummary = {
    count: discountedProducts.length,
    products: discountedProducts.map(product => ({
      name: product.name, regularPrice: product.regularPrice, price: product.price,
      discountPercent: product.discountPercent, discountReason: product.discountReason,
      stock: product.stock, category: product.category
    }))
  };
  res.json({
    date,
    today: {
      orders: ordersToday.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      active: active.length,
      revenueDelivered: sum(delivered),
      revenueWithoutCancelled: sum(active),
      deliveredItems: delivered.reduce((n, order) => n + (order.items || []).reduce((m, item) => m + Math.max(0, Number(item.qty) || 0), 0), 0)
    },
    inventory: {
      products: products.length,
      unitsInStock: products.reduce((n, product) => n + Math.max(0, Number(product.stock) || 0), 0),
      outOfStock: products.filter(product => Number(product.stock) === 0).length,
      lowStock: products.filter(product => Number(product.stock) > 0 && Number(product.stock) <= 3).length,
      discountedProducts: discountSummary.count
    },
    discounts: discountSummary,
    products,
    topProducts,
    recentOrders: [...ordersToday].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 25).map(order => ({
      id: order.id, status: order.status, total: order.total, date: order.date,
      items: (order.items || []).map(item => ({ name: item.name, qty: item.qty, price: item.price }))
    }))
  });
});

const admin = express.Router();
admin.use(requireAdmin);


admin.get('/stats', (req, res) => {
  const activeOrders = db.orders.filter(order => order.status !== 'Отменён');
  const sales = new Map();

  activeOrders.forEach(order => {
    (Array.isArray(order.items) ? order.items : []).forEach(item => {
      const key = String(item.productId || item.name || 'unknown');
      const qty = Math.max(0, Number(item.qty) || 0);
      const price = Math.max(0, Number(item.price) || 0);
      const row = sales.get(key) || {
        productId: item.productId || null,
        name: item.name || 'Товар без названия',
        image: item.image || item.photos?.[0] || '',
        photos: Array.isArray(item.photos) ? item.photos : (item.image ? [item.image] : []),
        qty: 0,
        revenue: 0,
        orderIds: new Set()
      };
      row.qty += qty;
      row.revenue += price * qty;
      row.orderIds.add(order.id);
      if (!row.image && (item.image || item.photos?.[0])) row.image = item.image || item.photos[0];
      sales.set(key, row);
    });
  });

  const salesProducts = [...sales.values()]
    .map(row => ({
      productId: row.productId,
      name: row.name,
      image: row.image,
      photos: row.photos,
      qty: row.qty,
      revenue: Math.round(row.revenue * 100) / 100,
      averagePrice: row.qty ? Math.round((row.revenue / row.qty) * 100) / 100 : 0,
      orderCount: row.orderIds.size
    }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const items = salesProducts.reduce((sum, row) => sum + row.qty, 0);
  const salesRevenue = Math.round(salesProducts.reduce((sum, row) => sum + row.revenue, 0) * 100) / 100;

  res.json({
    orders: db.orders.length,
    products: db.products.length,
    customers: new Set([...Object.keys(db.profiles), ...db.orders.map(order => order.uid)]).size,
    active: activeOrders.length,
    revenue: Math.round(activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) * 100) / 100,
    items,
    salesRevenue,
    salesOrders: activeOrders.length,
    discountedProducts: db.products.filter(p => Number(p.discountPercent) > 0 && Number(p.regularPrice) > Number(p.price)).map(p => ({id:p.id,name:p.name,price:p.price,regularPrice:p.regularPrice,discountPercent:p.discountPercent,stock:p.stock})),
    reviews: db.reviews.length,
    top: salesProducts.slice(0, 10),
    salesProducts
  });
});

admin.get('/products', (req, res) => {
  res.json([...db.products].sort((a, b) => b.id - a.id).map(product => ({...publicProduct(product), published: product.published !== false})));
});

admin.get('/categories', (req, res) => {
  res.json(db.categories);
});

admin.get('/orders', (req, res) => res.json([...db.orders].filter(order => !order.hiddenForAdmin).reverse()));

admin.get('/sales-report', (req, res) => {
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const from = validDate(req.query.from) ? String(req.query.from) : '';
  const to = validDate(req.query.to) ? String(req.query.to) : '';
  const soldOrders = db.orders.filter(order => order.status === 'Продано').map(order => ({
    ...order,
    soldAt: order.soldAt || (Array.isArray(order.statusHistory) ? [...order.statusHistory].reverse().find(x => x.status === 'Продано')?.at : '') || order.date
  })).filter(order => {
    const day = String(order.soldAt || '').slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  }).sort((a,b) => new Date(b.soldAt) - new Date(a.soldAt));
  const map = new Map();
  for (const order of soldOrders) for (const item of (order.items || [])) {
    const key = String(item.productId || item.name || 'unknown');
    const row = map.get(key) || {productId:item.productId || null,name:item.name || 'Товар',image:item.image || item.photos?.[0] || '',photos:item.photos || (item.image ? [item.image] : []),qty:0,revenue:0,orders:[]};
    const qty = Math.max(0, Number(item.qty) || 0), price = Math.max(0, Number(item.price) || 0);
    row.qty += qty; row.revenue += qty * price;
    row.orders.push({orderId:order.id,orderNo:order.orderNo || order.id,qty,price,total:Math.round(qty*price*100)/100,soldAt:order.soldAt,statusHistory:order.statusHistory || [{status:'Продано',at:order.soldAt}]});
    map.set(key,row);
  }
  const products = [...map.values()].map(row=>({...row,revenue:Math.round(row.revenue*100)/100,orders:row.orders.sort((a,b)=>new Date(b.soldAt)-new Date(a.soldAt))})).sort((a,b)=>b.revenue-a.revenue);
  res.json({from,to,orders:soldOrders.length,totalQty:products.reduce((n,p)=>n+p.qty,0),totalRevenue:Math.round(products.reduce((n,p)=>n+p.revenue,0)*100)/100,products});
});
// Список отдельных чатов покупателей и их переписка.
admin.get('/messages', (req, res) => {
 const chats = db.messages.filter(chat=>!chat.hiddenForAdmin).map(chat => {
  const profile = db.profiles[chat.uid] || {}; const orders = db.orders.filter(order => order.uid === chat.uid).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const last = (chat.messages || []).slice(-1)[0] || {};
  return { uid: chat.uid, subject: chat.subject || 'Общий вопрос', name: [profile.firstName,profile.lastName,profile.middleName].filter(Boolean).join(' ') || orders[0]?.name || 'Покупатель', phone: profile.phone || orders[0]?.phone || '', lastMessage: last.date || chat.createdAt || '', lastText: last.text || (last.image ? 'Фото' : ''), unread: (chat.messages || []).filter(m=>m.sender==='customer'&&!m.readByAdmin).length, messageCount: (chat.messages || []).length };
 }).sort((a,b)=>new Date(b.lastMessage)-new Date(a.lastMessage)); res.json(chats);
});
admin.delete('/messages/:uid',(req,res)=>{const c=db.messages.find(x=>x.uid===String(req.params.uid||''));if(!c)return errorResponse(res,'Чат не найден',404);c.hiddenForAdmin=true;save();res.json({ok:true});});
admin.post('/messages/:uid/open-order',(req,res)=>{const uid=String(req.params.uid||'');const order=db.orders.find(o=>String(o.id)===String(req.body?.orderId)&&o.uid===uid);if(!order)return errorResponse(res,'Заказ не найден или не принадлежит этому покупателю',404);let chat=db.messages.find(item=>item.uid===uid);if(!chat){chat={uid,subject:'Заказ №'+order.id,createdAt:new Date().toISOString(),messages:[]};db.messages.push(chat);}chat.hiddenForAdmin=false;chat.messages=Array.isArray(chat.messages)?chat.messages:[];let message=chat.messages.find(m=>m.sender==='admin'&&String(m.orderId)===String(order.id)&&m.orderContextNotice===true);if(!message){const products=(order.items||[]).map(i=>(i.name||'Товар')+' × '+Number(i.qty||1)+(i.size?' (размер '+i.size+')':'')).join('; ');const messageText='📦 Обращение магазина по вашему заказу №'+order.id+'.\nТовары: '+(products||'см. состав заказа')+'.\nПожалуйста, посмотрите это сообщение — мы хотим уточнить вопрос по данному заказу.';message={id:nextId(),uid,sender:'admin',text:messageText,image:'',date:new Date().toISOString(),readByCustomer:false,orderId:order.id,orderContextNotice:true};chat.messages.push(message);chat.lastMessage=message.date;chat.lastText=messageText;}save();res.json({ok:true,uid,orderId:order.id});});
admin.get('/messages/:uid/typing',(req,res)=>{const t=chatTyping.get(String(req.params.uid||''))||{};res.json({typing:Boolean(t.customer&&Date.now()-t.customer<2800)});});
admin.post('/messages/:uid/typing',(req,res)=>{const uid=String(req.params.uid||'');const t=chatTyping.get(uid)||{};if(req.body?.typing===true)t.admin=Date.now();else delete t.admin;chatTyping.set(uid,t);res.json({ok:true});});
admin.get('/messages/:uid', (req, res) => {
 const uid=String(req.params.uid||''); const chat=db.messages.find(item=>item.uid===uid&&!item.hiddenForAdmin); if(!chat)return errorResponse(res,'Чат не найден',404);
 const profile=db.profiles[uid]||{}; const orders=db.orders.filter(order=>order.uid===uid).sort((a,b)=>new Date(b.date)-new Date(a.date));
 (chat.messages||[]).forEach(m=>{if(m.sender==='customer')m.readByAdmin=true;}); save();
 res.json({uid,subject:chat.subject||'Общий вопрос',profile:{firstName:profile.firstName||'',lastName:profile.lastName||'',middleName:profile.middleName||'',phone:profile.phone||orders[0]?.phone||'',gender:profile.gender||orders[0]?.gender||'',age:profile.age||orders[0]?.age||'',address:profile.address||orders[0]?.address||'',photo:profile.photo||''},orders:orders.map(o=>({id:o.id,status:o.status,total:o.total,date:o.date})),messages:(chat.messages||[]).filter(m=>!m.deletedForEveryone&&!(m.hiddenFor||[]).includes('admin')).map(m=>{const order=m.orderId?orders.find(o=>String(o.id)===String(m.orderId)):null;return {...m,orderDetails:order?{...order,items:(order.items||[]).map(item=>({...item}))}:null}})});
});
admin.put('/messages/:uid/:messageId',(req,res)=>{const c=db.messages.find(x=>x.uid===String(req.params.uid||'')),m=c?.messages?.find(x=>String(x.id)===String(req.params.messageId));if(!m)return errorResponse(res,'Сообщение не найдено',404);if(m.sender!=='admin')return errorResponse(res,'Можно редактировать только своё сообщение',403);if(m.deletedForEveryone)return errorResponse(res,'Сообщение уже удалено');const value=text(req.body?.text,2000);if(!value&&!m.image)return errorResponse(res,'Сообщение не может быть пустым');m.text=value;m.editedAt=new Date().toISOString();save();res.json({ok:true,message:m});});
admin.delete('/messages/:uid/:messageId',(req,res)=>{const c=db.messages.find(x=>x.uid===String(req.params.uid||'')),m=c?.messages?.find(x=>String(x.id)===String(req.params.messageId));if(!m)return errorResponse(res,'Сообщение не найдено',404);if(req.body?.forEveryone===true&&m.sender!=='admin')return errorResponse(res,'Удалить у всех может только автор сообщения',403);if(req.body?.forEveryone===true){if(m.image)removeImage(m.image);c.messages.splice(c.messages.indexOf(m),1);}else{m.hiddenFor=Array.isArray(m.hiddenFor)?m.hiddenFor:[];if(!m.hiddenFor.includes('admin'))m.hiddenFor.push('admin');}save();res.json({ok:true});});

admin.post('/messages/:uid', (req, res) => {
 const uid=String(req.params.uid||''); const chat=db.messages.find(item=>item.uid===uid); if(!chat)return errorResponse(res,'Чат не найден',404);
 const messageText=text(req.body?.text,2000); let image=''; if(req.body?.image)image=saveImage(req.body.image);
 if(!messageText&&!image)return errorResponse(res,'Напишите ответ или прикрепите фото');
 const message={id:nextId(),uid,sender:'admin',text:messageText,image,date:new Date().toISOString(),readByCustomer:false}; chat.messages=Array.isArray(chat.messages)?chat.messages:[]; chat.messages.push(message); chat.lastMessage=message.date; chat.lastText=messageText||'Фото'; save(); res.json({ok:true,message});
});


// Customer directory for the owner panel. Private contact details are returned only
// behind requireAdmin and are never exposed by the public storefront API.
admin.get('/referrals', (req, res) => {
  const customers = Object.entries(db.profiles).map(([uid, profile]) => ({
    uid, profile,
    orders: db.orders.filter(order => order.uid === uid).sort((a,b)=>new Date(b.date)-new Date(a.date))
  }));
  const inviters = customers.filter(item => item.profile.referralCode).map(item => {
    const invited = customers.filter(candidate => candidate.profile.referredBy === item.uid);
    return {
      uid: item.uid,
      name: [item.profile.firstName, item.profile.lastName].filter(Boolean).join(' ') || 'Покупатель',
      phone: item.profile.phone || '',
      telegramId: item.profile.telegramId || (item.uid.startsWith('tg:') ? item.uid.slice(3) : ''),
      referralCode: item.profile.referralCode,
      invitedCount: invited.length,
      invitedWithOrders: invited.filter(candidate => candidate.orders.some(order => order.status !== 'Отменён')).length,
      invited: invited.map(candidate => ({
        uid: candidate.uid,
        name: [candidate.profile.firstName, candidate.profile.lastName].filter(Boolean).join(' ') || 'Покупатель',
        phone: candidate.profile.phone || '',
        telegramId: candidate.profile.telegramId || (candidate.uid.startsWith('tg:') ? candidate.uid.slice(3) : ''),
        createdAt: candidate.profile.createdAt || '',
        orderCount: candidate.orders.length,
        orders: candidate.orders.map(order => ({id:order.id,total:order.total,status:order.status,date:order.date}))
      }))
    };
  }).sort((a,b)=>b.invitedCount-a.invitedCount);
  res.json({totalCustomers:customers.length,referredCustomers:customers.filter(item=>item.profile.referredBy).length,inviters});
});
admin.get('/customers', (req, res) => {
  const ids = new Set([
    ...Object.keys(db.profiles),
    ...db.orders.map(order => order.uid).filter(Boolean)
  ]);
  const customers = [...ids].map(uid => {
    const profile = db.profiles[uid] || {};
    const orders = db.orders
      .filter(order => order.uid === uid)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = orders[0] || {};
    const name = [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(' ')
      || latest.name || 'Покупатель';
    return {
      name,
      phone: profile.phone || latest.phone || '',
      gender: profile.gender || latest.gender || '',
      age: profile.age || latest.age || '',
      address: profile.address || latest.address || '',
      orderCount: orders.length,
      totalSpent: Math.round(orders.filter(order => order.status !== 'Отменён').reduce((sum, order) => sum + Number(order.total || 0), 0) * 100) / 100,
      lastOrderDate: latest.date || '',
      orders: orders.map(order => ({
        id: order.id, total: order.total, date: order.date, status: order.status,
        items: order.items
      }))
    };
  }).sort((a, b) => new Date(b.lastOrderDate || 0) - new Date(a.lastOrderDate || 0));
  res.json(customers);
});

admin.put('/orders/:id', (req, res) => {
  const order = db.orders.find(item => item.id === Number(req.params.id));
  if (!order) return errorResponse(res, 'Заказ не найден', 404);
  const status = req.body?.status;
  if (!ADMIN_STATUSES.includes(status)) return errorResponse(res, 'Неверный статус');
  const wasCancelled = order.status === 'Отменён';
  const willBeCancelled = status === 'Отменён';
  const cancelReason = willBeCancelled ? text(req.body?.cancelReason, 300) : '';
  if (willBeCancelled && !cancelReason) return errorResponse(res, 'Укажите причину отмены заказа');
  if (willBeCancelled && !wasCancelled) {
    const canReturnToStock = !['Отправлен', 'В пути', 'Доставлен'].includes(order.status);
    if (canReturnToStock) {
      for (const item of order.items || []) {
        const product = db.products.find(product => product.id === item.productId);
        if (product) product.stock += Number(item.qty || 0);
      }
    }
    order.stockRestoredOnCancel = canReturnToStock;
  }
  if (wasCancelled && !willBeCancelled && order.stockRestoredOnCancel !== false) {
    const required = (order.items || []).map(item => [
      db.products.find(product => product.id === item.productId),
      Number(item.qty || 0)
    ]);
    if (required.some(([product, qty]) => !product || product.stock < qty)) {
      return errorResponse(res, 'Не хватает товара на складе, чтобы вернуть заказ в работу. Проверьте остатки товаров');
    }
    required.forEach(([product, qty]) => { product.stock -= qty; });
    order.stockRestoredOnCancel = false;
  }
  if (order.status !== status) {
    const changedAt = new Date().toISOString();
    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [{status: order.status || 'Новый', at: order.date || changedAt}];
    order.statusHistory.push({status, at: changedAt});
    if (status === 'Продано') { order.customerStatus = order.status === 'Продано' ? (order.customerStatus || 'Доставлен') : (order.status || 'Доставлен'); order.soldAt = changedAt; }
    else { order.customerStatus = ''; order.soldAt = ''; }
  }
  order.status = status;
  if (willBeCancelled) {
    order.cancelReason = cancelReason;
    order.cancelledAt = new Date().toISOString();
    order.cancelledBy = 'Администратор';
  } else {
    order.cancelReason = '';
    order.cancelledAt = '';
    order.cancelledBy = '';
  }
  save();
  res.json(order);
});

admin.delete('/orders/:id', (req, res) => {
  const order = db.orders.find(item => item.id === Number(req.params.id));
  if (!order) return errorResponse(res, 'Заказ не найден', 404);
  if (order.status !== 'Отменён') return errorResponse(res, 'Удалять можно только отменённые заказы', 400);
  order.hiddenForAdmin = true;
  save();
  res.json({ ok: true, id: order.id });
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
  const product = { id: nextId(), published: true, ...readProduct(req.body) };
  db.products.push(product);
  save();
  res.json(publicProduct(product));
});

admin.put('/products/:id/main-photo', (req, res) => {
  const product = db.products.find(item => item.id === Number(req.params.id));
  if (!product) return errorResponse(res, 'Товар не найден', 404);
  const photos = [...new Set([...(Array.isArray(product.photos) ? product.photos : []), product.image].filter(Boolean))];
  const selected = String(req.body?.photo || '');
  if (!selected || !photos.includes(selected)) return errorResponse(res, 'Выбранное фото не найдено у этого товара', 400);
  product.photos = [selected, ...photos.filter(photo => photo !== selected)].slice(0, 10);
  product.image = selected;
  save();
  res.json(publicProduct(product));
});

admin.put('/products/:id', (req, res) => {
  const product = db.products.find(item => item.id === Number(req.params.id));
  if (!product) return errorResponse(res, 'Товар не найден', 404);

  const previousPrice = Number(product.price);
  Object.assign(product, readProduct(req.body, product));
  if (Number(product.price) !== previousPrice) {
    delete product.regularPrice;
    delete product.discountPercent;
  }
  save();
  res.json(publicProduct(product));
});

admin.post('/products/:id/discount', (req, res) => {
  const product = db.products.find(item => item.id === Number(req.params.id));
  if (!product) return errorResponse(res, 'Товар не найден', 404);
  const percent = Number(req.body?.percent);
  if (!Number.isInteger(percent) || percent < 1 || percent > 99) return errorResponse(res, 'Укажите скидку целым числом от 1 до 99%', 400);
  const regularPrice = Number(product.discountPercent) > 0 && Number(product.regularPrice) > 0 ? Number(product.regularPrice) : Number(product.price);
  const discountedPrice = Math.round(regularPrice * (100 - percent)) / 100;
  if (!Number.isFinite(regularPrice) || regularPrice <= 0 || discountedPrice <= 0 || discountedPrice >= regularPrice) return errorResponse(res, 'Для этой цены нельзя применить такую скидку. Уменьшите процент.', 400);
  product.regularPrice = Math.round(regularPrice * 100) / 100;
  product.discountPercent = percent;
  product.price = discountedPrice;
  save();
  res.json(publicProduct(product));
});

admin.delete('/products/:id/discount', (req, res) => {
  const product = db.products.find(item => item.id === Number(req.params.id));
  if (!product) return errorResponse(res, 'Товар не найден', 404);
  if (Number(product.discountPercent) > 0 && Number(product.regularPrice) > 0) product.price = Number(product.regularPrice);
  delete product.regularPrice;
  delete product.discountPercent;
  delete product.discountReason;
  save();
  res.json(publicProduct(product));
});

admin.delete('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = db.products.find(item => item.id === id);
  if (!product) return errorResponse(res, 'Товар не найден', 404);

  [...new Set([product.image, ...(product.photos || [])].filter(Boolean))].forEach(removeImage);
  db.products = db.products.filter(item => item.id !== id);
  db.reviews = db.reviews.filter(review => review.productId !== id);
  save();
  res.json({ ok: true });
});

admin.get('/reviews', (req, res) => {
  res.json(
    [...db.reviews]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(review => {
        const product = db.products.find(product => product.id === review.productId);
        return {
          id: review.id, name: review.name, buyerName: review.buyerName || review.name,
          rating: review.rating, text: review.text, date: review.date,
          orderId: review.orderId || null, verified: Boolean(review.orderId), productId: review.productId,
          product: review.productName || product?.name || 'Удалённый товар',
          productName: review.productName || product?.name || 'Удалённый товар',
          productImage: review.productImage || product?.image || '',
          productPhotos: review.productPhotos || product?.photos || (product?.image ? [product.image] : []),
          productDesc: review.productDesc || product?.desc || '', productPrice: review.productPrice ?? product?.price ?? null
        };
      })
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
app.use('/downloads', express.static(path.join(__dirname, 'downloads'), { maxAge: '1h', index: false }));

// PWA: manifest, service worker и иконка для установки магазина на устройство.
const PWA_DIR = path.join(__dirname, 'pwa');
app.use('/pwa', express.static(PWA_DIR, { maxAge: '1h', index: false }));
app.get('/sw.js', (req, res) => {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(PWA_DIR, 'sw.js'));
});


const INDEX_FILE = path.join(__dirname, 'index.html');

app.get('/open-whatsapp', (req, res) => {
  const message = String(req.query.text || '').slice(0, 1800);
  const encoded = encodeURIComponent(message);
  const intentUrl = 'intent://send?text=' + encoded + '#Intent;scheme=whatsapp;package=com.whatsapp;end';
  const htmlEscape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  res.set('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Открыть WhatsApp</title><style>body{font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0;padding:22px;background:#f5f6fa;color:#171d2b}.card{max-width:380px;text-align:center;background:white;border-radius:18px;padding:26px;box-shadow:0 8px 30px #0001}.btn{display:block;margin-top:18px;padding:15px;border-radius:12px;background:#16a34a;color:white;text-decoration:none;font-weight:800}</style></head><body><main class="card"><b>HJ Premium Market</b><p>Нажмите кнопку, чтобы открыть обычный WhatsApp.</p><a class="btn" href="${htmlEscape(intentUrl)}">Открыть обычный WhatsApp</a><p style="font-size:12px;color:#777">Если приложение не открылось, убедитесь, что обычный WhatsApp установлен.</p></main><script>setTimeout(()=>{location.href=${JSON.stringify(intentUrl)}},350)</script></body></html>`);
});

app.get('/r/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!/^[A-Z0-9]{8,20}$/.test(code)) return res.status(404).send('Ссылка приглашения недействительна');
  const browserUrl = '/?ref=' + encodeURIComponent(code);
  const telegramUrl = 'https://t.me/HJ_Premium_Market_Bot?start=ref_' + encodeURIComponent(code);
  res.set('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#171d2b"><title>HJ Premium Market</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:#f5f6fa;font:16px system-ui,-apple-system,Segoe UI,Arial;color:#171d2b}.card{width:min(100%,390px);padding:28px 22px;background:#fff;border:1px solid #e8eaf0;border-radius:22px;box-shadow:0 12px 36px #17203312;text-align:center}.logo{font-size:22px;font-weight:900;letter-spacing:1px}.sub{color:#7b8290;font-size:13px;margin:9px 0 24px}.btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:50px;margin:10px 0;border-radius:13px;text-decoration:none;font-weight:800}.tg{background:#229ed9;color:white}.web{background:#f0f1f5;color:#171d2b}.hint{font-size:11px;color:#89909b;margin-top:16px}</style></head><body><main class="card"><div class="logo">HJ PREMIUM MARKET</div><div class="sub">Выберите, как открыть магазин</div><a class="btn tg" href="${telegramUrl}">✈ Открыть через Telegram</a><a class="btn web" href="${browserUrl}">🌐 Открыть магазин в браузере</a><div class="hint">Ваш переход по приглашению будет сохранён.</div></main></body></html>`);
});

app.get(['/', '/admin'], (req, res) => {
  // Always revalidate the app shell so mobile/Telegram webviews don't keep an old broken admin page.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(INDEX_FILE, { cacheControl: false }, error => {
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
  if (BOT_TOKEN) configureTelegramBot();
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.DATA_DIR && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.warn('ВНИМАНИЕ: Railway Volume не подключён — данные могут пропасть при новом деплое.');
  }
});
