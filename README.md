# JewelVal

Full-stack jewellery valuation management application for appraisers, banks, and jewellery loan workflows.

## Stack

- Frontend: React 18, Vite, TailwindCSS, React Router, Zustand
- Backend: Node.js, Express
- Database: SQLite with better-sqlite3 and Drizzle schema
- Print/PDF: html2canvas and jsPDF

## Quick Start (Local Development)

```bash
npm install
npm run setup
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001/api/health

## Production (Local)

```bash
npm run build
npm run start
```

In production the Express server serves `client/dist`.

## Deploy to Railway

This project is configured for deployment on [Railway](https://railway.app).

### Steps

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select your repository. Railway auto-detects the `railway.json` config.
4. Add a **Volume** (required for SQLite persistence):
   - In your service settings → **Volumes** → **Add Volume**
   - Mount path: `/data`
   - Size: 1 GB (or more)
5. Set **Environment Variables** in the Railway dashboard:
   - `NODE_ENV` = `production`
   - `DB_PATH` = `/data/jewel_val.db`
   - `PORT` = `3001` *(Railway also sets a PORT automatically via `${{PORT}}`)*
6. Deploy — Railway will build and start the app.

### Important Notes

- `better-sqlite3` is a native Node addon. Railway's Nixpacks builder compiles it automatically.
- The **Volume** ensures SQLite data survives redeployments and restarts.
- Railway's Hobby plan ($5/mo) supports volumes. The free trial includes $5 credit.
- Railway auto-assigns a public domain (e.g., `yourapp.up.railway.app`). You can add a custom domain in settings.

---

<details>
<summary><strong>Alternative: Deploy to Render</strong></summary>

A `render.yaml` is also included for [Render](https://render.com) deployment.

1. Push to GitHub/GitLab.
2. In Render: **New → Blueprint** → connect repo → done.
3. Or manually: Build command `npm install && npm run build`, Start command `npm run start`.
4. Add a persistent disk at `/opt/render/project/src/server/data` (1 GB).
5. Set env vars: `NODE_ENV=production`, `DB_PATH=/opt/render/project/src/server/data/jewel_val.db`.

Requires the Starter plan ($7/mo) for disk support.

</details>

## Environment

Create `server/.env` if needed:

```env
PORT=3001
NODE_ENV=development
DB_PATH=./data/jewel_val.db
```

## Demo Data

```bash
npm run seed:demo
```

The app also includes Settings → Demo Data controls for loading or clearing sample records.

## Default Login

- **Email:** demo@jwelval.in
- **Password:** admin123
