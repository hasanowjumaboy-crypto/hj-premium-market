
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Проверка работы магазина
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'HJ PREMIUM MARKET работает!',
    shop: 'HJ PREMIUM MARKET'
  });
});

// Каталог товаров
let products = [
  {
    id: 1,
    name: 'Premium товар',
    price: 1000,
    description: 'Описание товара',
    image: '',
    stock: 10
  }
];

// Получить товары
app.get('/api/products', (req, res) => {
  res.json(products);
});

// Добавить товар
app.post('/api/products', (req, res) => {
  const { name, price, description, image, stock } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Укажите название и цену товара'
    });
  }

  const product = {
    id: Date.now(),
    name,
    price: Number(price),
    description: description || '',
    image: image || '',
    stock: Number(stock || 0)
  };

  products.push(product);

  res.status(201).json({
    success: true,
    product
  });
});

// Удалить товар
app.delete('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);

  products = products.filter(product => product.id !== id);

  res.json({
    success: true,
    message: 'Товар удалён'
  });
});

// Заказы
let orders = [];

// Создать заказ
app.post('/api/orders', (req, res) => {
  const { customer, phone, items } = req.body;

  if (!customer || !phone || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Заполните данные заказа'
    });
  }

  const order = {
    id: Date.now(),
    customer,
    phone,
    items,
    status: 'Новый',
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  res.status(201).json({
    success: true,
    order
  });
});

// Получить все заказы
app.get('/api/orders', (req, res) => {
  res.json(orders);
});

// Изменить статус заказа
app.patch('/api/orders/:id', (req, res) => {
  const order = orders.find(
    item => item.id === Number(req.params.id)
  );

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Заказ не найден'
    });
  }

  order.status = req.body.status || order.status;

  res.json({
    success: true,
    order
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HJ PREMIUM MARKET</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #101114;
          color: white;
          text-align: center;
        }
        header {
          padding: 30px 15px;
          background: #191b20;
        }
        h1 {
          color: #d6b15e;
        }
        .container {
          padding: 30px 15px;
        }
        .product {
          background: #202329;
          padding: 20px;
          margin: 15px auto;
          border-radius: 12px;
          max-width: 400px;
        }
        button {
          background: #d6b15e;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>HJ PREMIUM MARKET</h1>
        <p>Добро пожаловать в наш магазин</p>
      </header>
      <main class="container">
        <h2>Наш каталог</h2>
        <div id="products">Загрузка товаров...</div>
      </main>
      <script>
        async function loadProducts() {
          const container = document.getElementById('products');

          try {
            const response = await fetch('/api/products');
            const products = await response.json();

            container.innerHTML = '';

            products.forEach(product => {
              const card = document.createElement('div');
              card.className = 'product';

              const name = document.createElement('h3');
              name.textContent = product.name;

              const description = document.createElement('p');
              description.textContent = product.description;

              const price = document.createElement('p');
              price.textContent = product.price + ' ₽';

              card.append(name, description, price);
              container.appendChild(card);
            });
          } catch (error) {
            container.textContent = 'Не удалось загрузить товары';
          }
        }

        loadProducts();
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HJ PREMIUM MARKET запущен на порту ${PORT}`);
});
