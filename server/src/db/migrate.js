import { sqlite, db } from './client.js'
import { valuationSeries } from './schema.js'
import { eq } from 'drizzle-orm'

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    mobile TEXT,
    aadhar_number TEXT,
    aadhar_photo TEXT,
    savings_ac_no TEXT,
    bank_name TEXT,
    branch TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS valuation_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    number_of_digits INTEGER NOT NULL DEFAULT 4,
    format_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS valuations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    valuation_number TEXT NOT NULL UNIQUE,
    series_id INTEGER NOT NULL REFERENCES valuation_series(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    format_type TEXT NOT NULL,
    valuation_date TEXT NOT NULL,
    ac_no TEXT,
    branch TEXT,
    gold_rate_22k REAL NOT NULL DEFAULT 0,
    gold_rate_24k REAL NOT NULL DEFAULT 0,
    market_value REAL NOT NULL DEFAULT 0,
    loan_amount REAL NOT NULL DEFAULT 0,
    valuation_fee REAL NOT NULL DEFAULT 0,
    rate_of_interest REAL,
    person_photo TEXT,
    jewellery_photo TEXT,
    ornament_photos TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    printed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS valuation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    valuation_id INTEGER NOT NULL REFERENCES valuations(id) ON DELETE CASCADE,
    sr_no INTEGER NOT NULL,
    description TEXT,
    no_of_units INTEGER NOT NULL DEFAULT 1,
    purity_percent REAL NOT NULL DEFAULT 0,
    purity_carat REAL NOT NULL DEFAULT 0,
    gross_weight_gm REAL NOT NULL DEFAULT 0,
    net_weight_gm REAL NOT NULL DEFAULT 0,
    net_24k_gold_gm REAL NOT NULL DEFAULT 0,
    net_22k_gold_gm REAL NOT NULL DEFAULT 0,
    approx_value_inr REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    valuation_id INTEGER NOT NULL REFERENCES valuations(id) ON DELETE CASCADE,
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    mode TEXT NOT NULL,
    reference_number TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_rates (
    rate_date TEXT PRIMARY KEY,
    gold_rate_22k REAL NOT NULL DEFAULT 0,
    gold_rate_24k REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS appraiser_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    appraiser_name TEXT,
    business_name TEXT,
    mobile TEXT,
    email TEXT,
    upi_id TEXT,
    logo_photo TEXT,
    address TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS bank_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_name TEXT NOT NULL,
    branch TEXT NOT NULL,
    rate_of_interest REAL,
    loan_ltv REAL,
    manager_name TEXT,
    address TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'PRO',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    user_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_val_customer ON valuations(customer_id);
  CREATE INDEX IF NOT EXISTS idx_val_series ON valuations(series_id);
  CREATE INDEX IF NOT EXISTS idx_val_status ON valuations(status);
  CREATE INDEX IF NOT EXISTS idx_items_val ON valuation_items(valuation_id);
  CREATE INDEX IF NOT EXISTS idx_pay_val ON payments(valuation_id);
`)

for (const stmt of [
  'ALTER TABLE customers ADD COLUMN aadhar_photo TEXT',
  'ALTER TABLE valuations ADD COLUMN person_photo TEXT',
  'ALTER TABLE valuations ADD COLUMN jewellery_photo TEXT',
  'ALTER TABLE valuations ADD COLUMN ornament_photos TEXT',
  'ALTER TABLE valuations ADD COLUMN valuation_fee REAL NOT NULL DEFAULT 0',
  'ALTER TABLE valuations ADD COLUMN application_id TEXT',
  'ALTER TABLE valuations ADD COLUMN branch_code TEXT',
  'ALTER TABLE valuation_items ADD COLUMN digital_id TEXT',
  'ALTER TABLE appraiser_profile ADD COLUMN empanelment_id TEXT',
  'ALTER TABLE appraiser_profile ADD COLUMN gstn TEXT',
]) {
  try { sqlite.exec(stmt) } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error
  }
}

sqlite.prepare(`
  INSERT OR IGNORE INTO appraiser_profile
  (id, appraiser_name, business_name, mobile, email, upi_id, address, updated_at)
  VALUES (1, 'Gold Appraiser', 'JewelVal Appraiser', '', '', '', '', ?)
`).run(new Date().toISOString())

const presetCount = sqlite.prepare('SELECT COUNT(*) AS n FROM bank_presets').get().n
if (!presetCount) {
  const nowPreset = new Date().toISOString()
  sqlite.prepare(`
    INSERT INTO bank_presets (bank_name, branch, rate_of_interest, loan_ltv, manager_name, address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('Bank of Maharashtra', 'Bibwewadi', 9.5, 57, '', 'Bibwewadi, Pune', nowPreset)
}

const userCount = sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n
if (!userCount) {
  sqlite.prepare(`
    INSERT INTO users (name, email, password_hash, plan, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'Demo Appraiser',
    'demo@jwelval.in',
    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    'PRO',
    new Date().toISOString()
  )
}

sqlite.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'demo@jwelval.in'
)

const now = new Date().toISOString()
const defaults = [
  { seriesName: 'RUSH-2025', prefix: 'RUSH-2025', formatType: 'RUSHIKESH' },
  { seriesName: 'DNYAN-2025', prefix: 'DNYAN-2025', formatType: 'DNYANESHWARI' },
  { seriesName: 'BOM-2025', prefix: 'BOM-2025', formatType: 'BANK_OF_MAHA' },
  { seriesName: 'DIGITAL-2025', prefix: 'GLCN', formatType: 'DIGITAL_CERT' },
]

for (const s of defaults) {
  const exists = await db
    .select()
    .from(valuationSeries)
    .where(eq(valuationSeries.seriesName, s.seriesName))
  if (exists.length === 0) {
    await db.insert(valuationSeries).values({
      ...s,
      currentNumber: 0,
      numberOfDigits: 4,
      createdAt: now,
    })
  }
}

console.log('[migrate] schema applied + default series ensured')
