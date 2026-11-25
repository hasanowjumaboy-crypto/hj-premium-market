# HJ PREMIUM MARKET

Telegram Mini App / web shop built with Node.js and Express.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Set the environment variables below.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Required environment variables

- `ADMIN_PASSWORD` — strong private password for `/admin`.
- `SESSION_SECRET` — long random secret used to sign admin sessions. Set it explicitly and keep it private.

## Optional environment variables

- `TELEGRAM_BOT_TOKEN` — bot token used to validate Telegram Mini App init data.
- `CURRENCY` — currency label shown in the store (default: `сомони`).
- `DATA_DIR` — directory for the database and uploaded images.
- `PORT` — HTTP port (Railway provides this automatically).

## Railway deployment

1. Deploy this GitHub repository as a Node.js service.
2. Add a Railway Volume and mount it at `/data`.
3. Set `DATA_DIR=/data`.
4. Add `ADMIN_PASSWORD` and a long random `SESSION_SECRET`.
5. If using the Telegram Mini App, add `TELEGRAM_BOT_TOKEN`.
6. Generate a public domain and open `/health`. It should return JSON with `ok: true`.
7. Open `/admin` to sign in and manage products, categories, orders, and reviews.

The database is stored in `db.json` and product/profile images are stored in `uploads/` under `DATA_DIR`. A persistent Railway Volume is important: without it, data can be lost when the service is redeployed or its container is replaced.

## Customer privacy and admin access

- The customer storefront does not display a link to the admin panel.
- Admin API endpoints require a signed, expiring admin token.
- Customer profiles and orders are returned only to the matching device identity or validated Telegram user.
- Do not share `ADMIN_PASSWORD`, `SESSION_SECRET`, or `TELEGRAM_BOT_TOKEN`.
