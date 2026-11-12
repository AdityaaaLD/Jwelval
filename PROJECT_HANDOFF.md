# JewelVal — Complete Project Handoff

Use this file as the full context for any new AI/developer session (e.g. Claude Desktop).
Last updated: 2026-11-05 (per-user print formats added). Latest commit before this change: `c3845d4` on `main`.

---

## 1. What the product is

**JewelVal** is a jewellery (gold) valuation and billing web app used by **gold appraisers/valuers** who work with banks (gold loans). The valuer meets the bank's customer live, mostly on a **phone or tablet**, fills a valuation, and produces:

1. **Digital Valuation Certificate** (the "valuation report") — A4 printable/PDF, shared with the bank.
2. **Sell Bill / Invoice** (the valuer's fee bill) — A4 printable/PDF.

Core business priorities (from the client, keep these in mind for every change):
- Data entry must be **fast and paper-like on mobile/tablet**; minimal scrolling; key info visible while entering.
- The client likes the **printed output**. Do not change print layout unless explicitly asked.
- Empty printed fields must **keep their position** and show a **writable blank line** for pen completion.
- **Jewellery photos must never be cropped.**
- Renewal tracking is **internal only** — never printed.
- "Share as PDF" must share the **actual PDF file** (Web Share API), not a link.
- Existing data must never be destroyed; migrations must be **idempotent and additive**.

Users are multi-tenant: every row is scoped by `user_id`. The **first user to sign up becomes admin**; later signups are `PENDING` until an admin approves them.

---

## 2. Repository, branches, remotes

- Local path: `C:\Users\ADMIN\Downloads\Jwelval` (Windows machine).
- Branch: `main` (production). Restore tag: `pre-valuation-redesign` (before the mobile form redesign). Old branch `valuation-form-redesign` exists historically.
- **Two remotes — always push to both:**
  - `origin` → https://github.com/Aditya123learner/Jwelval.git
  - `adityaald` → https://github.com/AdityaaaLD/Jwelval.git
  - Note: sometimes the second push errors with "cannot lock ref … is at <new sha>" — the remote is already updated (they appear linked). Verify with `git ls-remote adityaald refs/heads/main`.
- Never force-push or rewrite history.
- Untracked, intentionally not committed: `Claude outputs/`, `client/vite.config.js.timestamp-*.mjs`, `tmp_pdf_review/`, `ref_formats/`, `DOC-*.pdf`.
- Other docs in repo (may be older than this file): `README.md`, `CLAUDE_PROMPT.md`, `PROJECT_TIMELINE.md`, `SOLUTION_ARCHITECTURE.md`.

---

## 3. Tech stack

| Layer | Tech |
|---|---|
| Client | React 18, Vite 5, Tailwind CSS 3, Zustand (form state), React Router 6, lucide-react icons, react-hot-toast, `qrcode`, `tesseract.js` (client OCR), `@fontsource/arimo` 5.2.8 (certificate font) |
| Server | Node ≥18 (prod Node 20), Express 4, Drizzle ORM 0.36 + `better-sqlite3` (SQLite, WAL mode), express-validator, bcryptjs, morgan |
| PDF | `puppeteer-core` 23 + **system Chromium from Nix** (no bundled download) |
| Email | SendGrid or AWS SES (`@sendgrid/mail`, `@aws-sdk/client-ses`), or stub |
| OCR | Google Cloud Vision (server, `/api/ocr`), Tesseract.js (client fallback for Aadhaar) |
| Monorepo | npm workspaces: `client`, `server`, `shared` (root `package.json`) |

---

## 4. Hosting & deployment

### Production: Railway (Nixpacks)
- `railway.json`:
  - build: `PUPPETEER_SKIP_DOWNLOAD=true npm install --workspaces --include-workspace-root && npm run build`
  - start: `NODE_ENV=production DB_PATH=/data/jewelval.db node server/src/index.js`
  - healthcheck: `/api/health` (timeout 30s), restart ON_FAILURE (max 10).
  - SQLite lives on a Railway **volume mounted at `/data`** → file `/data/jewelval.db`. Do not change this path or data is "lost".
- `nixpacks.toml`:
  - nixPkgs: `nodejs_20, python3, gcc, gnumake, pkg-config, chromium, fontconfig, freetype, liberation_ttf, dejavu_fonts`
  - `aptPkgs = []` — **required**. Nixpacks otherwise injects `apt-get install chromium`, which failed (Ubuntu mirror / IPv6 unreachable) and broke deploys.
  - `PUPPETEER_SKIP_DOWNLOAD=true`, `PUPPETEER_EXECUTABLE_PATH=/nix/var/nix/profiles/default/bin/chromium`.
- **Never reintroduce full `puppeteer`** (it downloads Chrome during install and made builds flaky). Root lockfile must not contain `puppeteer` (only `puppeteer-core`).
- In production the Express server **also serves the built client** (`client/dist`) with SPA fallback; `index.html` is `no-store`, assets `max-age=0, must-revalidate`.
- The Railway server clock is **UTC** — any time shown on documents must be formatted with `Asia/Kolkata` (already done, see §9.6).

### Railway operations (checked in the dashboard 2026-11-12)
- Project `cheerful-sparkle`, environment `production`, service `jewelval` (region Southeast Asia / Singapore). Source repo **AdityaaaLD/Jwelval → main**, auto-deploys on every push (`origin`/Aditya123learner is not connected to Railway).
- Domains: `www.jwelval.com` (target port 10000) and `jewelval-production-be6d.up.railway.app`. `/api/health` is public.
- Volume `jewelval-jewelval-data`, mount `/data`, size 5 GB, ~1.17 GB used (2026-11-12). Usage alerts at 80 / 95 / 100 % are enabled. Variable `DB_PATH=/data/jewelval.db` (same as the start command), so the data path does not depend on railway.json.
- **Backups:** there were none until 2026-11-12. Now: manual backup 2026-11-12 11:30 (1.17 GB) + automatic Daily (kept 6 days), Weekly (27 days), Monthly (89 days). Manual backups are limited to 50 % of the volume size — resize the volume (or move images out of SQLite) before data passes ~2.5 GB. Restoring a backup deletes newer backups; always take a manual backup before a restore or a risky deploy.
- **Cron schedule removed 2026-11-12** (it was `0 0 * * *` on the web service, which disabled the restart policy: "Services with a cron schedule do not have a restart policy"). Restart policy On Failure is active again.
- **To do before 2026-12-01:** Railway shows "Config as Code is deprecated… Existing config files keep working until 2026-12-01". Move the railway.json settings (build command, start command, healthcheck `/api/health` + timeout, restart policy) into the service settings in the dashboard (or Railway's Infrastructure-as-Code), then verify a deploy. The Nixpacks builder is also marked deprecated — plan a test of the Railpack builder (keep puppeteer-core + Nix/system Chromium working).
- Replicas are not possible while a volume is attached; volume services have a short downtime on every deploy.

### Alternative: Render (`render.yaml`)
Web service, Node 20, `PUPPETEER_SKIP_DOWNLOAD=true npm install && npm run build`, start `npm run start`, PORT 10000, disk mounted at `/opt/render/project/src/server/data`, `DB_PATH=/opt/render/project/src/server/data/jewel_val.db`. Not the primary host.

### Startup sequence (`server/src/index.js`)
1. `import('./db/migrate.js')` — runs all idempotent migrations on every boot.
2. `runStartupChecks()` — requires `CORS_ORIGINS` (prod) and `EMAIL_FROM`; validates mailer config (fails in prod if no SendGrid/SES creds unless `ALLOW_STUB_MAILER_IN_PROD=true`).
3. `app.listen(PORT, '0.0.0.0')`; `requestTimeout` 150s (PDF rendering).

### Environment variables
| Var | Purpose / default |
|---|---|
| `NODE_ENV` | `production` on Railway |
| `PORT` | set by host; default 3001 |
| `DB_PATH` | SQLite path (Railway `/data/jewelval.db`; local `server/data/jewel_val.db`) |
| `CORS_ORIGINS` | required in prod, comma-separated app origin(s); also used as QR base fallback |
| `EMAIL_FROM` | required |
| `MAIL_PROVIDER` | `auto` (default) / `sendgrid` / `ses` / `stub` |
| `SENDGRID_API_KEY` | SendGrid |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | SES |
| `ALLOW_STUB_MAILER_IN_PROD` | `true` only for testing |
| `MAIL_SEND_MAX_RETRIES` (3), `MAIL_SEND_BACKOFF_MS` (400) | mail retry |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium path |
| `PDF_BASE_URL` | URL Chromium opens for PDF rendering (default `http://127.0.0.1:$PORT` in prod, `http://127.0.0.1:5173` in dev) |
| `PDF_REQUEST_TIMEOUT_MS` (120000), `PDF_NAV_TIMEOUT_MS` (45000), `PDF_READY_TIMEOUT_MS` (40000), `PDF_MAX_CONCURRENCY` (2), `REQUEST_TIMEOUT_MS` (150000) | PDF timing |
| `QR_VERIFY_BASE_URL` / `PUBLIC_APP_URL` | public base URL encoded in certificate QR codes |
| `OTP_TTL_MINUTES` 5, `OTP_MAX_ATTEMPTS` 10, `OTP_MAX_SENDS_PER_HOUR` 15, `OTP_RESEND_COOLDOWN_SECONDS` 60, `OTP_EMAIL_MAX_10_MIN` 15, `OTP_EMAIL_MAX_DAY` 40, `OTP_IP_MAX_HOUR` 30, `OTP_VERIFY_IP_MAX_HOUR` 120 | OTP limits (env overrides defaults — check Railway vars) |
| `API_RATE_LIMIT_WINDOW_MS` 60000 / `API_RATE_LIMIT_MAX_REQS` 120 | general API limiter |
| `AUTH_RATE_LIMIT_WINDOW_MS` 900000 / `AUTH_RATE_LIMIT_MAX_REQS` 90 | `/api/auth` limiter |
| `SUBSCRIPTION_RATE_LIMIT_*` (15 min / 20) | subscription requests |
| `SUBSCRIPTION_SUPPORT_EMAIL` | default `support@logic-motive.com` |
| `GOOGLE_APPLICATION_CREDENTIALS` / `GOOGLE_VISION_CREDENTIALS_JSON` / `GOOGLE_VISION_CREDENTIALS_BASE64` | Google Vision OCR |
| `MEMORY_LOG_INTERVAL_MS` | optional memory logging |

Secrets live in Railway variables / `server/.env` (gitignored). Never commit them.

---

## 5. Local development

```bash
npm run install:all        # root + client + server
npm run dev                # server (nodemon, :3001) + client (vite, :5173)
npm --prefix client run build   # production build = main client verification
npm run setup              # run migrations manually
npm run seed:demo          # demo data
npm --prefix server run backup  # server/scripts/backup.js
```
- Vite proxies `/api` → `http://localhost:3001`. If the API isn't running you'll see `ECONNREFUSED` / "internal server error" in the client.
- Windows notes: PowerShell may block `npm.ps1` and rejects `&&`; use bash (Git Bash) or `cmd /c`. `rg` isn't installed.
- **No working ESLint** in the repo (`npx eslint` pulls an incompatible version). Verification = `vite build` + `node --check` on server files.
- Server syntax checks:
  ```bash
  node --check server/src/routes/valuations.js
  node --check server/src/routes/sellBills.js
  node --check server/src/routes/verify.js
  node --check server/src/db/migrate.js
  ```
- **End-to-end testing approach used so far** (works well): copy the real DB with `better-sqlite3` `.backup()` into `%TEMP%`, run `node server/src/db/migrate.js` with `DB_PATH` pointing to the copy, insert a test session row (`sessions(token,user_id,user_json,created_at)`), start the server with `NODE_ENV=production PORT=30xx DB_PATH=<copy> CORS_ORIGINS=http://127.0.0.1:30xx EMAIL_FROM=t@example.com MAIL_PROVIDER=stub ALLOW_STUB_MAILER_IN_PROD=true PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" PDF_BASE_URL=http://127.0.0.1:30xx`, then drive it with `puppeteer-core` + local Chrome (set `localStorage.jewelval_token`). The machine can be slow: wait up to ~2 min for `/api/health`. Never touch the real `server/data/jewel_val.db`.

---

## 6. Project structure

```
client/src/
  App.jsx                    routes
  main.jsx, index.css
  context/AuthContext.jsx    session (token in localStorage 'jewelval_token')
  lib/api.js                 fetch wrapper (/api, Bearer token, 401 → /login)
  lib/share.js               fetchValuationPdf / fetchSellBillPdf / sharePdf (Web Share API + fallbacks)
  lib/format.js              inr, num, formatDateDMY, formatDateIST, formatTimeIST, INDIA_TZ, parseDateInputToISO
  lib/imageCompress.js       compressDataUrl, normalizeLogoImage
  lib/qr.js                  verificationUrl
  lib/aadharOcr.js           Aadhaar OCR helper
  store/valuationStore.js    Zustand valuation form state, calculations, payload()
  components/
    ImageCropModal.jsx       crop/rotate editor (preserveFullImage, rotateOnly modes)
    SignedPagesPanel.jsx     bank-signed report pages UI
    Layout.jsx, ProtectedRoute.jsx, QrImage.jsx, StatusBadge.jsx, WhatsAppMark.jsx, SplashScreen.jsx
    print/
      PrintModal.jsx         valuation print/share dialog
      PrintDigitalCert.jsx   Standard valuation certificate (default layout — never change)
      PrintHelpers.jsx       resolveReportDateTime, CertificateRules, SignatureGrid, VerificationBlock …
      SellBillDocument.jsx   Standard sell bill layout (shared by modal + PDF render page)
      formats/index.js       print-format registry: format id → component (see §13)
      formats/SbiAnnexure8.jsx, formats/BobAnnexure4.jsx   bank-form valuation layouts
      formats/bankForm/      shared parts for bank forms (PagedForm pagination, letterhead/QR/photos/KYC parts, bankForms.css)
      SellBillPrint.jsx      sell bill print/share dialog
      FeeReceipt.jsx, PrintRushikesh.jsx, PrintDnyaneshwari.jsx, PrintBankOfMaha.jsx  ← legacy, UNUSED
  pages/
    PublicHome, Login, Subscribe, Dashboard, VerifyCertificate (public QR page)
    PrintRender.jsx          /print/valuation/:id  (page Chromium captures for valuation PDF)
    SellBillRender.jsx       /print/sell-bill/:id  (page Chromium captures for sell-bill PDF)
    valuations/ValuationForm.jsx, ValuationList.jsx
    sellbills/SellBillForm.jsx, SellBillList.jsx
    customers/CustomerList, CustomerForm, CustomerDetail
    payments/PaymentList, PaymentSection
    reports/ItemWiseReport, CustomerWiseReport
    settings/AppraiserProfile, BankPresets, DailyRates, NumberSeries, OrnamentMaster, DemoData
    admin/ManageUsers.jsx, admin/PrintFormatsDialog.jsx (admin assigns print formats)
  styles/print.css           all certificate / sell bill print CSS

server/src/
  index.js                   express app, middleware, static client, bootstrap
  mailer.js                  SendGrid/SES/stub with retries
  db/client.js               better-sqlite3 (WAL, busy_timeout 5000, FKs on), drizzle
  db/schema.js               drizzle tables
  db/migrate.js              idempotent migrations (runs every boot)
  db/seed-demo.js
  middleware/auth.js         requireAuth (Bearer token → sessions table, 30-day expiry)
  middleware/rateLimit.js    in-memory rate limiters
  lib/compute.js             item/totals math (deriveItem, totalsFromItems, bankRecommendedFromRate, LOAN_LTV)
  lib/numbering.js           reserveNextValuationNumber
  lib/defaultValuationSeries.js, defaultBillSeries.js, defaultOrnaments.js
  lib/pdfRenderer.js         puppeteer-core pool → renderUrlToPdf()
  lib/printFormats.js        print-format catalog (ids, labels, admin options), resolve/freeze helpers
  lib/googleVision.js, logger.js
  routes/ auth, customers, series, valuations, payments, reports, dashboard, demo, rates,
          profile, presets, verify, subscriptions, ornaments, sellBills, ocr, printFormats
server/scripts/ backup.js, load-otp.js, smoke-otp.js, test-*.js (contention, mailer, memory, restart)
```

### Client routes
Public: `/`, `/login`, `/subscribe`, `/verify/:number`, `/print/valuation/:id`, `/print/sell-bill/:id`.
Authenticated (AppShell): `/dashboard`, `/customers[/new|/:id|/:id/edit]`, `/valuations[/new|/:id]`, `/payments`, `/reports/item-wise`, `/reports/customer-wise`, `/settings/{series,demo,rates,profile,banks,ornaments}`, `/sell-bills[/new|/:id]`, `/admin/users`.

### API (all under `/api`, auth = `Authorization: Bearer <token>` except public)
- Public: `GET /health`, `/auth/*` (rate-limited), `GET /verify/base-url`, `GET /verify/:number`, `/subscriptions/request-access`.
- Auth: `POST /auth/signup` (first user → admin ACTIVE; others PENDING), `GET /auth/signup-status`, `POST /auth/login` (password → then **email OTP** required), `POST /auth/request-otp` (VERIFY_EMAIL / RESET_PASSWORD), `POST /auth/verify-otp`, `POST /auth/reset-password`, `GET /auth/me`, `POST /auth/logout`; admin: `POST /auth/create-user`, `GET /auth/users`, `POST /auth/users/:id/approve|reject|send-verification-otp`, `DELETE /auth/users/:id`.
- Valuations: `GET /valuations`, `POST /valuations`, `GET/PUT/DELETE /valuations/:id` (PUT/DELETE blocked when locked; DELETE only drafts), `GET /valuations/:id/pdf` (`?reportAt=`, `?includeKyc=1`), `POST /:id/duplicate`, `POST /:id/mark-renewed`, `POST /:id/mark-printed` (body `{printedAt}`), signed pages: `GET/POST /:id/signed-pages`, `DELETE /:id/signed-pages/:pageId`, `POST /:id/signed-pages/lock`.
- Sell bills: `GET /sell-bills`, `POST /sell-bills`, `GET /sell-bills/:id`, `GET /sell-bills/:id/pdf`, `DELETE /sell-bills/:id`, `GET/POST /sell-bills/series` (GET auto-creates current-year default series).
- Print formats: `GET /print-formats` (catalog, any user), admin only: `GET /print-formats/summary`, `GET/PUT /print-formats/users/:userId`.
- Others: customers CRUD, `series` (list/create/rename/next), `presets/banks` CRUD + `next-app-id` / `preview-app-id`, `profile` GET/PUT, `rates` GET/POST, `ornaments` CRUD, `payments`, `reports/item-wise|customer-wise`, `dashboard`, `demo/load|reset`, `ocr`.

---

## 7. Database (SQLite)

Tables (schema.js + migrate.js): `users`, `sessions`, `otp_tokens`, `customers`, `valuation_series`, `valuations`, `valuation_items`, `valuation_signed_pages`, `payments`, `daily_rates`, `appraiser_profile`, `bank_presets`, `ornament_master`, `bill_series`, `sell_bills`, `sell_bill_items`, `print_format_assignments` (+ subscription request storage).

Key `valuations` columns: valuation_number, series_id, customer_id, format_type, valuation_date, ac_no, branch, branch_code, application_id, bank_preset_id, gold_rate_22k/24k, market_value, loan_amount (= "Sanction Loan Amount"), bank_gold_rate_per_gram, loan_ltv, bank_recommended_value, valuation_fee, rate_of_interest, loan_type, tenure_months, certificate_rules, person_photo, jewellery_photo, ornament_photos (JSON), aadhar_photo_doc, pan_photo, customer_snapshot (JSON, immutable copy of customer at creation), gold_loan_register_no, gold_packets_no, renewal_date, duplicate_of_id, renewal_root_id, renewal_number, status (`DRAFT`/`PRINTED`/`LOCKED`), printed_at, signed_pages_locked_at, print_format, print_format_options (JSON; frozen at lock, NULL = Standard), user_id, created_at, updated_at.

Key `sell_bills` columns: bill_number, bill_series_id, valuation_id, customer_id, bill_date, subtotal, gst_percent, gst_amount, total, advance, balance, payment_mode, total_packets (TEXT), convenience_fee (REAL, NULL = blank line), reappraisal_total (unused, kept for compatibility), print_format, print_format_options (frozen at creation, NULL = Standard), user_id.

`print_format_assignments`: id, user_id, doc_type (`VALUATION`/`SELL_BILL`), bank_preset_id (0 = user default, else override for that bank preset), format_id, options_json, updated_by, created_at, updated_at. UNIQUE(user_id, doc_type, bank_preset_id). No row = Standard.

Images (photos, logos, signed pages) are stored as **base64 data URLs in TEXT columns**. `express.json` limit is 50 MB.

### Migration rules (`server/src/db/migrate.js`)
- Runs on every boot; everything is `CREATE … IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` with "duplicate column" ignored.
- Contains a **legacy cleanup** that rebuilds `customers/valuations/sell_bills` if their DDL has global UNIQUE constraints and drops legacy UNIQUE indexes. Intentional per-user unique indexes must be listed in `INTENTIONAL_UNIQUE_INDEXES` (currently `idx_valuations_renewal_sequence`) and created **after** that cleanup.
- `idx_valuations_renewal_sequence` = UNIQUE(user_id, renewal_root_id, renewal_number) WHERE renewal_number > 0. If existing data has duplicates, creation is skipped and logged (startup never crashes, data never rewritten).
- `server/src/routes/valuations.js` also applies a few optional `ALTER TABLE` patches at import time.

---

## 8. Valuation workflow (how it works end to end)

1. **Customer** created (name, Aadhaar + OCR, mobile, alternate mobile, Aadhaar address, current address, A/C no, bank, photos: customer, Aadhaar front/back, PAN).
2. **New Valuation** (`ValuationForm.jsx`, mobile-first, 3 tabs kept mounted — **do not switch to conditional mounting**, it caused data loss):
   - **Details**: customer, bank format (bank preset → branch, branch code, empanelment, ROI, LTV, rules, application-ID preview), valuation date (dd-mm-yyyy), number series, A/C no, application ID, customer/loan type, tenure; collapsed "More details": branch code, gold loan register no (digits), gold packets no, renewal date; identity photos (read-only from customer).
   - **Ornaments**: compact 2-line rows, no horizontal scroll (line 1: #, description native `<select>` with "Other (type)…", value, delete; line 2: units, gross g, net g, karat, remarks select). Built for 20+ items.
   - **Loan & Photos**: market value, bank loan value (bank rate × net), LTV %, loan as per LTV, Loan Amount (sanction), ROI, valuation fee; main jewellery photo (required) + extra ornament photos.
   - Sticky customer/market-value snapshot at top, sticky action bar at bottom. Validation auto-switches to the tab with the error. New-form reset happens synchronously; async loads only fill empty fields. Autosave every 30s for drafts.
3. **Save Draft / Preview** → **PrintModal** opens. It pre-generates the server PDF (so the share sheet can open within the tap gesture on iOS).
4. **Share as PDF** (bank copy, **no KYC page**) or **Print / Save PDF** (includes KYC page + signed pages) → on success a DRAFT is **locked** (`mark-printed` → status `LOCKED`, `printed_at`). Locked reports cannot be edited (server returns 403 `DOCUMENT_LOCKED`).
5. Locked report: "Print Again", "Create Sales Invoice", Duplicate, and **Signed Report Pages** panel.

### Duplicate & Renewal (internal only)
- Duplicate creates a new DRAFT copy (same customer by default, new number, `duplicate_of_id` set, signed pages NOT copied).
- On a duplicate draft, "Mark as Renewed" assigns Renewal #N per original chain (`renewal_root_id`), inside an immediate SQLite transaction. Only drafts that are duplicates of the same customer can be marked.
- List shows "Renewal #N" / "N renewed" badges; filters: All / Due for Renewal / Renewed + exact renewal date. Due = renewal date ≤ today, not draft, and latest in its chain. **Never printed.**

### Bank-signed report pages
Flow: valuer shares unsigned PDF with bank → bank signs → valuer opens the same (locked) report → **Signed Report Pages**: Take Photo / From Gallery (multi-select, queued) → rotate-only editor (no crop, max 2000px, JPEG 0.85) → pages numbered in order; remove/re-add allowed → **Confirm & Lock Pages** makes them permanent. Server enforces: report must be locked, no changes after lock, JPEG/PNG/WebP data URLs ≤ 12 MB string, max 30 pages, owner only. Signed pages appear **after the KYC page in preview/print only — never in the shared PDF**. List shows a "Signed" badge.

---

## 9. Digital Valuation Certificate (`PrintDigitalCert.jsx` + `styles/print.css`)

### 9.1 Layout per A4 page
Running header on every page: letterhead (logo, business name, proprietor, qualification, organization, cert no, address, mobile, WhatsApp icon+number, email, GSTN, bank A/C, empanelment ID, QR badge "Scan & Verify") → Application ID / Gold Loan Register No / Date+time → Certificate No / Gold Packets No / Renewal Date → From (business, proprietor, appraiser ID) / To (bank, manager, branch code, branch) / borrower photo / jewellery photo → borrower block (name, Aadhaar, mobile, alternate mobile, Aadhaar address, current address, A/C no, bank, branch) → fixed 3×4 loan grid:

| Left | Middle | Right |
|---|---|---|
| Loan Type | Bank Gold Rate | Amount as per Bank Rate |
| Rate of Interest | Market Gold Rate | Amount as per Market Rate |
| Tenure (Months) | Total Gross Weight | Loan Amount (as per LTV) |
| LTV | Total Net Weight | Sanction Loan Amount (= `loanAmount`) |

All fields always present; empty → blank underline (`.dc-meta-blank`, `.dc-blank-wide`). Then the ornament table (repeated headings each page). **Total Market Value row only once, after the last item.** Bottom of every page: certificate rules + bank logo box, then signatures (Branch Manager, Joint Custodian, Customer: <name>, Appraiser With Name) pinned to the page bottom.

### 9.2 Pagination (manual, measured)
Chrome can't repeat a tall header, so the component measures and paginates itself:
- Constants: `PAGE_HEIGHT_MM = 296.9`, `PAGE_PAD_Y_MM = 13` (6mm top + 7mm bottom), `SAFETY_PX = 6`. CSS must match: `.print-page.digital-cert.dc-cert-page { height: 296.9mm; padding: 6mm 6.5mm 7mm 6.5mm }` (screen and print).
- Stages: measure natural column widths → lock widths → measure row heights (fractional `getBoundingClientRect`, divided by CSS preview scale on mobile) → `paginateRows` fills pages **forward**; footer (rules+logo+signatures) reserved on every page; total row only on last page; if total doesn't fit, minimum trailing rows move to a new page.
- Each page gets an empty **filler row** so the table always runs into the rules box (no gap); a final layout pass corrects it to exact pixels (1px border overlap).
- Waits for fonts (Arimo 400/500/600/700) and images before measuring. Exposes `data-dc-ready="true"` when done; `PrintRender` waits for it before Chromium captures; PrintModal's Print waits for it + all images.
- **Font**: Arimo (Arial-metric, bundled via @fontsource) so phone preview, desktop and server PDF wrap identically. Print CSS must not override certificate font sizes (they were removed so print == measured screen).
- Verified: preview pages == shared PDF pages on 390px phone and desktop.

### 9.3 KYC page
Aadhaar front/back + PAN; shown in preview/print with a "not included in shared PDF" notice (`no-print`). Shared PDF uses `?kyc=0`.

### 9.4 Photos
Jewellery photos use `preserveFullImage` (contain, no zoom/pan, white padding) and print with `object-fit: contain`. Borrower photo uses cover. Crop modal is full-screen on mobile (`100dvh`, fixed header/footer, scrolling middle).

### 9.5 QR / verification
QR encodes `<QR base>/verify/<valuationNumber>`. Public page `VerifyCertificate.jsx` shows: certificate no, date, customer, valuer, **branch name, branch code**, status (verified if LOCKED/PRINTED), Printed At.

### 9.6 Report time (fixed 2026-10-14)
- Report time = `printedAt`; for a draft, PrintModal fixes `reportAt` once when it opens, the PDF prints it (`?reportAt=` → PrintRender), and `mark-printed` saves the same value as `printedAt` (server accepts only times within last 24h / +5min, else uses now; never overwrites once locked). Report and QR page show identical time.
- All timestamps formatted in **IST** (`formatDateIST` / `formatTimeIST`, `Asia/Kolkata`) because the PDF server runs in UTC (that caused the 5.5h difference).

---

## 10. Sell Bill (`SellBillForm.jsx`, `SellBillDocument.jsx`, `routes/sellBills.js`)

- Created from scratch or from a locked valuation ("Create Sales Invoice" → first item "Valuation Fee" = valuation fee). New bills always start with a "Valuation Fee" row.
- Header: same valuer identity as the certificate (logo, business name, proprietor, qualification, organization, cert no, address, mobile, WhatsApp, email, GSTN, bank A/C, empanelment ID) — shown once (duplicate block was removed).
- Title bar: **"TAX INVOICE" when GST is ticked, "INVOICE" when not.**
- Bill To: name, mobile + alternate, Aadhaar address, current address, Aadhaar no; meta: invoice no, date, payment mode, valuation ref.
- Main table, column heading **"Gold Reappraisal Bill"**: row 1 **Total Packets** (count, not added), then item rows (e.g. Valuation Fee), last row **Convenience Fees** (₹). Empty packets/convenience print a blank line.
- Totals: **Subtotal = items + convenience fee**; GST % editable (default 3%, e.g. 18%) applied on subtotal, printed as CGST/SGST halves; final row **"Total Amount"**; advance/balance if advance > 0. Server computes the same totals.
- Terms, signatures (Customer / For <business> Authorised Signatory), footer.
- Share as PDF: `GET /api/sell-bills/:id/pdf` → Chromium renders `/print/sell-bill/:id` → real PDF shared via Web Share API.
- Current-year default bill series auto-created for every user (`ensureDefaultBillSeriesForUser`).
- Bills are create-only (no edit endpoint). Known gap: an item row with an amount but empty description is silently dropped on save.

---

## 11. PDF generation details (`server/src/lib/pdfRenderer.js`)
- Shared headless Chromium (`--no-sandbox --disable-dev-shm-usage --font-render-hinting=none` …), max 2 concurrent renders, viewport 1240×1754.
- Sets `localStorage.jewelval_token` on the app origin, opens the print route, waits `networkidle0` and `body[data-print-ready="true"]` (or `data-print-error`), then `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })`. Certificate uses `@page { size: A4; margin: 0 }`.
- Executable resolution: `PUPPETEER_EXECUTABLE_PATH` → `chromium`/`google-chrome` on PATH → common paths (incl. Windows Chrome/Edge).

---

## 12. Auth, OTP, admin
- Sessions: random token in `sessions` table, 30-day expiry, `Authorization: Bearer`.
- Login = password, then email OTP (purpose LOGIN). Email must be verified (VERIFY_EMAIL OTP). Password reset via RESET_PASSWORD OTP. Legacy SHA-256 hashes auto-upgrade to bcrypt.
- OTP limits (current): 15 sends/user/hour, 15 per email per 10 min, 40 per email per day, 30 per IP per hour, 60s resend cooldown, 10 wrong attempts per OTP, 5-minute validity. Env vars override these defaults.
- Admin (`/admin/users`): create users, approve/reject pending, resend verification OTP, delete, and assign print formats per user / per bank (see §13).

---

## 13. Per-user print formats (built 2026-11-05)

Client decision: the current layouts are the **Standard** ones and are never changed. A client can get an entirely different layout (style, structure, everything) built from their sample. **Only the admin** assigns layouts — per user, and optionally per bank preset of that user. Layouts adapt to JewelVal's data; the application/data model is not changed to fit a paper form (fields JewelVal doesn't store print as writable blank lines).

### How it works
- **Catalog (source of truth):** `server/src/lib/printFormats.js` → `PRINT_FORMATS` (id, label, description, admin-editable `options` schema: boolean / text / textarea / number with defaults, max length, min/max). Server validates/sanitizes all options.
- **Registry (components):** `client/src/components/print/formats/index.js` maps id → component + `readySelector` / `pageRuleSelector` / `allowNoImages`. Unknown id → Standard. Keep both lists in sync.
- **Assignment:** Manage Users → "Print formats" under a user's name → dialog (mobile full-screen): Valuation report: *Default for this user* + *Per bank* (each bank preset: "Same as user default" or a format) with **Customize this format** (options per assignment, "Reset to defaults"). Sell bill: same (only Standard exists today). Saved via `PUT /api/print-formats/users/:userId` (admin only; replaces that user's assignments in one transaction; bank preset must belong to that user).
- **Resolution:** valuation → bank override (valuation.bank_preset_id, or the same bank/branch fallback the certificate uses) → user default → Standard. Sell bill → bank of its linked valuation → user default → Standard.
- **Freezing (data safety):** a valuation stores `print_format` + full merged `print_format_options` when it is **locked** (`mark-printed`); a sell bill stores them when it is **created**. Reprints / QR / bank copies never change if the admin re-assigns later. Documents locked before this feature (NULL) always show **Standard** (what they were issued in). Drafts follow the live assignment. Duplicates start as drafts (live assignment).
- API responses (`hydrate` in valuations.js, `hydrateBill` in sellBills.js) include `printFormat` + `printFormatOptions`; PrintModal, PrintRender (`/print/valuation/:id`), SellBillPrint and SellBillRender (`/print/sell-bill/:id`) render the component from the registry and wait for its ready selector — so preview, Print and the shared PDF always use the same layout.
- Known tiny race: if the admin changes a user's format in the seconds between a draft's PDF being generated and it being locked, the lock freezes the new assignment.

### Formats available
| Doc | Id | Label |
|---|---|---|
| Valuation | `STANDARD` | Standard — Digital Valuation Certificate (`PrintDigitalCert`, untouched) |
| Valuation | `SBI_ANNEX8` | SBI — Appraiser Certificate (Annexure-8) |
| Valuation | `BOB_ANNEX4` | Bank of Baroda — Jewel Assaying Certificate (Annexure-4) |
| Sell bill | `STANDARD` | Standard — Invoice / Tax Invoice (`SellBillDocument`, untouched) |

Bank forms (samples from the client, 2026-11-05: SBI Annexure-8 letter; BoB Annexure-4 page 1 — page 2 not built yet):
- Fill from app data only. SBI: "S/o ____" and "in the presence of ____ (Cash in charge)" are always blank lines (client chose not to add fields). "No. of article" = units; precious-stones weight column left blank to write. BoB: every ornament is its own row (no fixed Bangles/Kada/… category rows — client decision), Deductions = gross − net, Rate per gram = market 22K rate, Jewel Type option (default Gold), blank rows padded up to `minRows` only while they fit on the last page.
- Extras on by default (admin can switch each off per assignment): valuer letterhead, QR Scan & Verify (+ cert no.), jewellery photo (never cropped, `object-fit: contain`), borrower photo, bank logo from Bank Preset, reference line (certificate no., application ID, GL register no., packets no., IST date/time), borrower mobile/alternate/Aadhaar, loan summary (same 12 values as Standard), item remarks. Editable texts: annexure label, title, relation label, testing method, declarations (support `{bank}`/`{branch}`), place (empty = branch name), minimum rows.
- Same rules as Standard: Arimo font, measured pagination (`formats/bankForm/PagedForm.jsx`, A4 296.9mm, padding 8/10/7/10mm, page 1 full head, continuation pages compact head + repeated table head, total row + declarations/signatures on the last page, "Certificate No. … Page x of y"), overflow self-check, `data-format-ready="true"` when done, KYC sheet + bank-signed pages after the form in preview/print only (never in shared PDF), times in IST, renewal tracking never printed.

### Adding a new client format (checklist)
1. Get the client's sample (photo/PDF). Map every printed field to existing JewelVal data; anything not stored → blank line (ask the client before adding new fields).
2. Add an entry to `PRINT_FORMATS` in `server/src/lib/printFormats.js` (new unique id, label, description, options with defaults).
3. Create the component in `client/src/components/print/formats/` (reuse `bankForm/PagedForm`, `useCertContext`, `certData`, `parts`), register it in `formats/index.js` with its ready selector.
4. Never change the printed output of an id already in use (locked documents reference it) — create a new id (e.g. `SBI_ANNEX8_V2`) instead; never remove an id.
5. Verify: build, `node --check`, preview pages == shared PDF pages at 390px and desktop, Standard output still pixel-identical, then assign it to the user in Manage Users.

## 14. Change history (most recent first, all on `main`, pushed to both remotes)
- *(this change)* Per-user print formats: admin assigns valuation / sell bill layouts per user and per bank preset with editable options; layout frozen on lock (valuation) / creation (sell bill); new SBI Annexure-8 and Bank of Baroda Annexure-4 valuation layouts; Standard layouts untouched (pixel-identical PDFs verified).
- `c3845d4` Complete project handoff document
- `4946c1a` OTP send limit 15/hour (+10-min 15, day 40, IP 30)
- `7fcd4d8` Doubled OTP and auth rate limits
- `0c534ec` Report time == QR time, always IST
- `4114f21` Sell bill first row prefilled "Valuation Fee"
- `742c6a8` Sell bill: packets & convenience fee inside main table; fee in GST base; "Total Amount"
- `7fc9060` Sell bill: TAX INVOICE / INVOICE heading by GST
- `1ed57c1` Bank-signed report pages (print only, lock on confirm)
- `b0dbfe7` Renewal uniqueness index kept across restarts
- `bab386b` Certificate: no gap under table; preview == shared PDF (Arimo font, no print font overrides, scale-aware measuring)
- `3876da5` / `e94452e` / `6f0cc5d` / `b1a0550` Certificate pagination iterations (final: footer + signatures on every page, forward fill)
- `4695b0f` Fixed 3×4 loan grid + internal renewal workflow
- `0336a32` QR branch name/code, both addresses + phones, mobile crop modal, sell bill heading parity, total only on last page
- `b2a0fe6` Valuation tab state stability
- `65abda1` Full jewellery photo preservation
- `06ec403` Removed duplicate proprietor/address on sell bill
- `d419c32` Sell bill Share as PDF
- `4510173` Editable GST % on sell bill
- `fba2bc1` Writable blank lines for empty report fields
- `4d1ed6f` Deploy fix: puppeteer-core + Nix Chromium + `aptPkgs = []`
- `cb1eec6`, `09c751c` Compact no-scroll ornament rows, native description select
- `c0bf42f`, `f7b0f4a`, `507a39e` Mobile-first tabbed valuation form redesign (tag `pre-valuation-redesign` = before)
- `4ae8d95` Auto current-year default sell bill series

---

## 15. Known gaps / follow-ups
- Bank of Baroda Annexure-4 page 2 (client to send sample); more client formats as samples arrive (§13 checklist).
- Admin cannot preview a format with sample data before assigning (assign to own account to check).
- Manage Users table is clipped on phones (pre-existing; Status/Actions columns not reachable at 390px).
- Sell bill: rows with amount but no description are dropped silently on save (suggested: block save with an error).
- Sell bills can't be edited after creation.
- Legacy print components (`PrintRushikesh/Dnyaneshwari/BankOfMaha`, `FeeReceipt`) are dead code; `valuation_series.format_type` is still not used for printing (formats come from admin assignments, §13).
- `sell_bills.reappraisal_total` column unused.
- Check Railway variables for OTP/rate-limit overrides (env beats code defaults).
- One unreproduced instance of a first PDF request failing right after a cold server start (9/9 retries succeeded).

---

## 17. Roadmap & decisions (agreed with the client 2026-11-12)

Principle: **one core app for everyone; every user's profile can differ** (print layouts, settings, plan). Existing users and their documents must never change unless the admin changes them; data must never be lost.

### Status of the print-formats change (not yet pushed on 2026-11-12)
- Tested locally on a copy of the local DB (`server/data/local-test.db`, gitignored) in Chrome: assignments, SBI/BoB/Standard previews, 22-item pagination, lock-freeze, sell bill, shared PDFs (page counts match preview without KYC).
- Effect on existing users after deploy: none visible. Everyone stays on Standard (no assignments exist), Standard components untouched (PDFs pixel-identical in tests), migration only adds 4 empty columns + 1 empty table, old locked reports always render Standard. Only the admin sees the new "Print formats" link. The deploy itself restarts the service (~1–3 min downtime) → deploy at a quiet time, take a manual Railway backup first.
- Local run note: Vite on the Windows laptop answers only on `localhost` (IPv6), so start local runs with `PDF_BASE_URL=http://localhost:5173` (plus `EMAIL_FROM=test@example.com MAIL_PROVIDER=stub DB_PATH=<copy>`), otherwise local PDF sharing hangs. Production is not affected.

### Decided direction
1. **Real database:** move from SQLite-on-volume to managed **PostgreSQL** without impacting production users: build on a branch, migrate with identical IDs/numbers/timestamps, verify row counts + per-row checksums + pixel-identical PDFs of locked reports, rehearse on a copy of production data, cut over in a short night maintenance window, keep the old volume untouched (read-only) ≥30 days for rollback.
2. **Full admin panel** (designed first in Claude's design tool, matching the current look, mobile-first): overview, users, access requests stored in DB, subscriptions (plans ₹10,000/user/year → ₹299/user/month, start/end, status, grace), payments (manual first), print formats, audit log, system (backups). Existing users start as Active/grandfathered with no end date; expiry never deletes or hides reports (suggested: read-only).
3. **Print formats without coding for every client:** a template system stored in the database — a block-based, versioned print-template builder in the admin panel (letterhead, text with field placeholders, field grids, ornament table with configurable columns, photos, QR, declarations, signatures, page setup), rendered by one shared measured-pagination engine, with live preview on real reports and a test PDF before publishing. Published versions are immutable; documents freeze the template version at lock. Code-based templates (Standard, SBI, BoB) remain available. Build this on top of Postgres.
4. Photos/signed pages: later move from base64-in-DB to private object storage (Railway bucket) to keep the DB small.

### Order
Push print formats (after testing) → Postgres migration (foundation) → admin panel + subscriptions → template builder → images to bucket. Before 2026-12-01: move railway.json settings into the Railway dashboard.

## 16. Working rules for whoever continues
1. Keep `main` production-safe; build (`npm --prefix client run build`) and `node --check` server files before committing; test risky changes end-to-end on a DB copy.
2. Commit with clear messages and push to **both** remotes; verify with `git ls-remote`.
3. Never change the certificate/sell bill print output beyond what's asked (Standard layouts are fixed; client-specific layouts are separate format ids, §13). Keep empty fields as writable lines.
4. Never print renewal metadata; never put KYC or signed pages in the shared PDF.
5. Migrations: additive + idempotent only; never rewrite or delete existing records.
6. Don't reintroduce full `puppeteer`; keep `aptPkgs = []`.
7. Always format document times in IST.
8. Mobile first: test at ~390px width; avoid horizontal scrolling; keep tabs mounted.
9. Ask the user when business rules are ambiguous (they prefer being asked over guesses), then implement production-grade.
