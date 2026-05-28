import { sqlite } from './client.js'

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    role TEXT NOT NULL DEFAULT 'user',
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

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS ornament_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bill_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    number_of_digits INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sell_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT NOT NULL UNIQUE,
    bill_series_id INTEGER REFERENCES bill_series(id),
    valuation_id INTEGER REFERENCES valuations(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    bill_date TEXT NOT NULL,
    order_no TEXT,
    cheque_no TEXT,
    cheque_date TEXT,
    bank TEXT,
    bank_branch TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    gst_percent REAL NOT NULL DEFAULT 3,
    gst_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    advance REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sell_bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL REFERENCES sell_bills(id) ON DELETE CASCADE,
    sr_no INTEGER NOT NULL,
    particular TEXT,
    karat_purity TEXT,
    pcs INTEGER NOT NULL DEFAULT 1,
    gross_weight REAL NOT NULL DEFAULT 0,
    net_weight REAL NOT NULL DEFAULT 0,
    rate REAL NOT NULL DEFAULT 0,
    making REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_sell_bills_valuation ON sell_bills(valuation_id);
  CREATE INDEX IF NOT EXISTS idx_sell_bill_items_bill ON sell_bill_items(bill_id);
`)

for (const stmt of [
  'ALTER TABLE customers ADD COLUMN aadhar_photo TEXT',
  'ALTER TABLE customers ADD COLUMN alternate_mobile TEXT',
  'ALTER TABLE valuations ADD COLUMN person_photo TEXT',
  'ALTER TABLE valuations ADD COLUMN jewellery_photo TEXT',
  'ALTER TABLE valuations ADD COLUMN ornament_photos TEXT',
  'ALTER TABLE valuations ADD COLUMN valuation_fee REAL NOT NULL DEFAULT 0',
  'ALTER TABLE valuations ADD COLUMN application_id TEXT',
  'ALTER TABLE valuations ADD COLUMN branch_code TEXT',
  'ALTER TABLE valuations ADD COLUMN loan_type TEXT',
  'ALTER TABLE valuation_items ADD COLUMN digital_id TEXT',
  'ALTER TABLE valuations ADD COLUMN aadhar_photo_doc TEXT',
  'ALTER TABLE valuations ADD COLUMN pan_photo TEXT',
  'ALTER TABLE appraiser_profile ADD COLUMN empanelment_id TEXT',
  'ALTER TABLE appraiser_profile ADD COLUMN gstn TEXT',
  'ALTER TABLE bank_presets ADD COLUMN branch_code TEXT',
  'ALTER TABLE bank_presets ADD COLUMN app_id_prefix TEXT',
  'ALTER TABLE bank_presets ADD COLUMN app_id_current_number INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE bank_presets ADD COLUMN app_id_digits INTEGER NOT NULL DEFAULT 10',
  'ALTER TABLE customers ADD COLUMN aadhar_photo_back TEXT',
  'ALTER TABLE customers ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE valuations ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE valuation_series ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE bank_presets ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE daily_rates ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE ornament_master ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE sell_bills ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE bill_series ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE appraiser_profile ADD COLUMN user_id INTEGER',
  "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
]) {
  try { sqlite.exec(stmt) } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error
  }
}

// Recreate daily_rates to support multi-user (rate_date is no longer sole PK)
try {
  const hasDailyRatesUserId = sqlite.prepare("PRAGMA table_info('daily_rates')").all().some(c => c.name === 'user_id')
  if (hasDailyRatesUserId) {
    const hasOldPk = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_rates'").get()
    if (hasOldPk?.sql?.includes('rate_date TEXT PRIMARY KEY')) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS daily_rates_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rate_date TEXT NOT NULL,
          gold_rate_22k REAL NOT NULL DEFAULT 0,
          gold_rate_24k REAL NOT NULL DEFAULT 0,
          user_id INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(rate_date, user_id)
        );
        INSERT OR IGNORE INTO daily_rates_new (rate_date, gold_rate_22k, gold_rate_24k, user_id, created_at, updated_at)
          SELECT rate_date, gold_rate_22k, gold_rate_24k, COALESCE(user_id, 1), created_at, updated_at FROM daily_rates;
        DROP TABLE daily_rates;
        ALTER TABLE daily_rates_new RENAME TO daily_rates;
      `)
    }
  }
} catch (e) { console.log('[migrate] daily_rates rebuild skipped:', e.message) }

// Rebuild appraiser_profile to remove CHECK(id=1) constraint for multi-user
try {
  const profileSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='appraiser_profile'").get()
  if (profileSql?.sql?.includes('CHECK')) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS appraiser_profile_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appraiser_name TEXT,
        business_name TEXT,
        mobile TEXT,
        email TEXT,
        upi_id TEXT,
        logo_photo TEXT,
        address TEXT,
        empanelment_id TEXT,
        gstn TEXT,
        user_id INTEGER,
        updated_at TEXT
      );
      INSERT INTO appraiser_profile_new SELECT id, appraiser_name, business_name, mobile, email, upi_id, logo_photo, address, empanelment_id, gstn, user_id, updated_at FROM appraiser_profile;
      DROP TABLE appraiser_profile;
      ALTER TABLE appraiser_profile_new RENAME TO appraiser_profile;
    `)
  }
} catch (e) { console.log('[migrate] appraiser_profile rebuild skipped:', e.message) }

// Assign user_id = 1 to existing records that have no user_id set
try {
  sqlite.exec(`
    UPDATE customers SET user_id = 1 WHERE user_id IS NULL OR user_id = 0;
    UPDATE valuations SET user_id = 1 WHERE user_id IS NULL OR user_id = 0;
    UPDATE valuation_series SET user_id = 1 WHERE user_id IS NULL OR user_id = 0;
    UPDATE bank_presets SET user_id = 1 WHERE user_id IS NULL OR user_id = 0;
    UPDATE ornament_master SET user_id = 1 WHERE user_id IS NULL OR user_id = 0;
    UPDATE sell_bills SET user_id = 1 WHERE user_id IS NULL OR user_id = 0;
    UPDATE bill_series SET user_id = 1 WHERE user_id IS NULL OR user_id = 0;
    UPDATE appraiser_profile SET user_id = 1 WHERE user_id IS NULL;
  `)
} catch (e) { console.log('[migrate] user_id assignment skipped:', e.message) }

// No demo user seeded — users must sign up.
// Default data (ornaments, series, profile, presets) is seeded per-user on signup via seedDefaultsForUser in auth.js.

console.log('[migrate] schema applied')
