import express from 'express';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
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

const STATUSES = ['Новый', 'Подтверждён', 'Собирается', 'Собран', 'Отправлен', 'В пути', 'Доставлен', 'Отменён'];

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

function identifyChatCustomer(req, res, next) {
  const deviceId = String(req.headers['x-device-id'] || '');
  if (!/^[a-f0-9]{32}$/.test(deviceId)) return errorResponse(res, 'Нет идентификатора устройства', 401);
  const uid = 'web:' + hash(deviceId).toString('hex').slice(0, 32);
  const telegram = telegramUser(req.headers['x-tg-init-data']);
  if (!db.messages.some(item => item.uid === uid) && telegram) {
    const legacy = db.messages.find(item => item.uid === 'tg:' + telegram.id);
    if (legacy) { legacy.uid = uid; (legacy.messages || []).forEach(message => { message.uid = uid; }); save(); }
  }
  req.uid = uid;
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
    photos: Array.isArray(product.photos) && product.photos.length ? product.photos : (product.image ? [product.image] : []),
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
  const command = String(message?.text || '').trim().split(/\s+/, 1)[0].split('@')[0].toLowerCase();
  if (!chatId) return;

  if (command === '/start' || command === '/start@hj_premium_market_bot') {
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

app.get('/api/profile', identifyCustomer, (req, res) => {
  const profile = db.profiles[req.uid] || {
    firstName: text(req.telegram?.first_name, 40),
    lastName: text(req.telegram?.last_name, 40),
    middleName: '',
    phone: '',
    gender: '',
    age: '',
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
  const gender = text(body.gender, 20);
  const age = Number(body.age);

  if (!firstName) return errorResponse(res, 'Укажите имя');
  if (!phone) return errorResponse(res, 'Укажите номер телефона');
  if (!['Мужской', 'Женский'].includes(gender)) return errorResponse(res, 'Укажите пол');
  if (!Number.isInteger(age) || age < 1 || age > 120) return errorResponse(res, 'Укажите корректный возраст');
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
    gender,
    age,
    address: text(body.address, 300),
    photo
  };

  save();
  res.json(db.profiles[req.uid]);
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
    .filter(order => order.uid === req.uid)
    .map(order => ({
      id: order.id,
      items: (order.items || []).map(item => ({ ...item, reviewed: db.reviews.some(review => review.uid === req.uid && review.productId === item.productId) })),
      total: order.total,
      status: order.status,
      cancelReason: order.cancelReason || '',
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
  for (const item of order.items) {
    const product = db.products.find(product => product.id === item.productId);
    if (product) product.stock += item.qty;
  }
  order.status = 'Отменён';
  order.cancelReason = text(req.body?.cancelReason, 300);
  order.cancelledAt = new Date().toISOString();
  order.cancelledBy = 'Покупатель';
  order.stockRestoredOnCancel = true;
  save();
  res.json({ ok: true, order });
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
    name: [profile.lastName, profile.firstName, profile.middleName].filter(Boolean).join(' '),
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
    reviews: db.reviews.length,
    top: salesProducts.slice(0, 10),
    salesProducts
  });
});

admin.get('/products', (req, res) => {
  res.json([...db.products].sort((a, b) => b.id - a.id).map(publicProduct));
});

admin.get('/categories', (req, res) => {
  res.json(db.categories);
});

admin.get('/orders', (req, res) => res.json([...db.orders].reverse()));
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
  if (!STATUSES.includes(status)) return errorResponse(res, 'Неверный статус');
  const wasCancelled = order.status === 'Отменён';
  const willBeCancelled = status === 'Отменён';
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
  order.status = status;
  if (willBeCancelled) {
    order.cancelReason = text(req.body?.cancelReason, 300);
    order.cancelledAt = order.cancelledAt || new Date().toISOString();
    order.cancelledBy = req.body?.cancelledBy === 'Покупатель' ? 'Покупатель' : 'Администратор';
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
  db.orders = db.orders.filter(item => item.id !== order.id);
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
  const product = { id: nextId(), ...readProduct(req.body) };
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

  Object.assign(product, readProduct(req.body, product));
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
  if (BOT_TOKEN) configureTelegramBot();
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.DATA_DIR && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.warn('ВНИМАНИЕ: Railway Volume не подключён — данные могут пропасть при новом деплое.');
  }
});
