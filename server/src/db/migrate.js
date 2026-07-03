import { sqlite } from './client.js'
import { DEFAULT_ORNAMENTS } from '../lib/defaultOrnaments.js'

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code TEXT NOT NULL,
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
    valuation_number TEXT NOT NULL,
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
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    email_verified INTEGER NOT NULL DEFAULT 0,
    approved_by INTEGER,
    approved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    user_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS otp_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL,
    consumed_at TEXT,
    UNIQUE(user_id, purpose, created_at)
  );

  CREATE TABLE IF NOT EXISTS otp_request_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    ip TEXT NOT NULL,
    purpose TEXT NOT NULL,
    created_at TEXT NOT NULL,
    outcome TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_otp_user_purpose ON otp_tokens(user_id, purpose);
  CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_otp_user_purpose_active ON otp_tokens(user_id, purpose, consumed_at, created_at);
  CREATE INDEX IF NOT EXISTS idx_otp_audit_email_time ON otp_request_audit(email, created_at);
  CREATE INDEX IF NOT EXISTS idx_otp_audit_ip_time ON otp_request_audit(ip, created_at);

  CREATE INDEX IF NOT EXISTS idx_val_customer ON valuations(customer_id);
  CREATE INDEX IF NOT EXISTS idx_val_series ON valuations(series_id);
  CREATE INDEX IF NOT EXISTS idx_val_status ON valuations(status);
  CREATE INDEX IF NOT EXISTS idx_items_val ON valuation_items(valuation_id);
  CREATE INDEX IF NOT EXISTS idx_pay_val ON payments(valuation_id);
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS ornament_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
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
    bill_number TEXT NOT NULL,
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
  'ALTER TABLE valuations ADD COLUMN customer_snapshot TEXT',
  'ALTER TABLE valuations ADD COLUMN bank_gold_rate_per_gram REAL',
  'ALTER TABLE valuations ADD COLUMN bank_ltv REAL',
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
  'ALTER TABLE sell_bills ADD COLUMN payment_mode TEXT',
  'ALTER TABLE payments ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE appraiser_profile ADD COLUMN proprietor_name TEXT',
  'ALTER TABLE appraiser_profile ADD COLUMN qualification TEXT',
  'ALTER TABLE appraiser_profile ADD COLUMN organization TEXT',
  'ALTER TABLE appraiser_profile ADD COLUMN cert_number TEXT',
  "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE'",
  'ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN approved_by INTEGER',
  'ALTER TABLE users ADD COLUMN approved_at TEXT',
]) {
  try { sqlite.exec(stmt) } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error
  }
}

// Backfill payments.user_id from valuations
try {
  const hasUserId = sqlite.prepare("PRAGMA table_info('payments')").all().some(c => c.name === 'user_id')
  if (hasUserId) {
    sqlite.exec(`
      UPDATE payments SET user_id = (
        SELECT user_id FROM valuations v WHERE v.id = payments.valuation_id
      ) WHERE user_id IS NULL OR user_id = 1;
    `)
  }
} catch (e) { console.log('[migrate] payments backfill skipped:', e.message) }

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
        proprietor_name TEXT,
        qualification TEXT,
        organization TEXT,
        cert_number TEXT,
        user_id INTEGER,
        updated_at TEXT
      );
      INSERT INTO appraiser_profile_new (id, appraiser_name, business_name, mobile, email, upi_id, logo_photo, address, empanelment_id, gstn, user_id, updated_at)
        SELECT id, appraiser_name, business_name, mobile, email, upi_id, logo_photo, address, empanelment_id, gstn, user_id, updated_at FROM appraiser_profile;
      DROP TABLE appraiser_profile;
      ALTER TABLE appraiser_profile_new RENAME TO appraiser_profile;
    `)
  }
} catch (e) { console.log('[migrate] appraiser_profile rebuild skipped:', e.message) }

// Rebuild ornament_master to remove global UNIQUE on name (now per-user)
try {
  const ornSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ornament_master'").get()
  if (ornSql?.sql?.includes('UNIQUE')) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS ornament_master_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        user_id INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      INSERT INTO ornament_master_new (id, name, user_id, created_at)
        SELECT id, name, COALESCE(user_id, 1), created_at FROM ornament_master;
      DROP TABLE ornament_master;
      ALTER TABLE ornament_master_new RENAME TO ornament_master;
    `)
  }
} catch (e) { console.log('[migrate] ornament_master rebuild skipped:', e.message) }

// Remove global UNIQUE on customer_code, valuation_number, bill_number for multi-user
// Must disable FK checks so we can drop/rebuild tables that are referenced by others
sqlite.exec('PRAGMA foreign_keys = OFF')
for (const table of ['customers', 'valuations', 'sell_bills']) {
  try {
    const info = sqlite.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table)
    if (!info?.sql) continue
    if (!info.sql.match(/\bUNIQUE\b/i)) continue
    const cols = sqlite.prepare(`PRAGMA table_info('${table}')`).all()
    const colList = cols.map(c => c.name).join(', ')
    let newDdl = info.sql.replace(
      new RegExp(`CREATE\\s+TABLE\\s+["'\`]?${table}["'\`]?`, 'i'),
      `CREATE TABLE "${table}_rebuild"`
    )
    newDdl = newDdl.replace(/\bUNIQUE\b/gi, '')
    sqlite.exec(`DROP TABLE IF EXISTS "${table}_rebuild"`)
    sqlite.exec(newDdl)
    sqlite.exec(`INSERT INTO "${table}_rebuild" (${colList}) SELECT ${colList} FROM "${table}"`)
    sqlite.exec(`DROP TABLE "${table}"`)
    sqlite.exec(`ALTER TABLE "${table}_rebuild" RENAME TO "${table}"`)
    console.log(`[migrate] rebuilt ${table} — removed UNIQUE constraint`)
  } catch (e) { console.log(`[migrate] ${table} rebuild skipped:`, e.message) }
}
// Clean up any leftover temp tables from prior failed migrations
for (const suffix of ['_new', '_rebuild']) {
  for (const table of ['customers', 'valuations', 'sell_bills']) {
    try { sqlite.exec(`DROP TABLE IF EXISTS "${table}${suffix}"`) } catch (e) { /* ignore */ }
  }
}
sqlite.exec('PRAGMA foreign_keys = ON')

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

// Fallback: if table rebuild failed but UNIQUE indexes exist as separate indexes, drop them
try {
  const indexes = sqlite.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND sql LIKE '%UNIQUE%'").all()
  for (const idx of indexes) {
    if (['customers', 'valuations', 'sell_bills'].includes(idx.tbl_name)) {
      try { sqlite.exec(`DROP INDEX IF EXISTS "${idx.name}"`) } catch (e2) { /* ignore */ }
      console.log(`[migrate] dropped UNIQUE index ${idx.name} on ${idx.tbl_name}`)
    }
  }
} catch (e) { /* ignore */ }

// Add remarks column to valuation_items
try { sqlite.exec(`ALTER TABLE valuation_items ADD COLUMN remarks TEXT`) } catch (e) { /* already exists */ }

// Add bank_recommended_value column to valuations
try { sqlite.exec(`ALTER TABLE valuations ADD COLUMN bank_recommended_value REAL`) } catch (e) { /* already exists */ }

// Add certificate_rules column to bank_presets and valuations
try { sqlite.exec(`ALTER TABLE bank_presets ADD COLUMN certificate_rules TEXT`) } catch (e) { /* already exists */ }
try { sqlite.exec(`ALTER TABLE valuations ADD COLUMN certificate_rules TEXT`) } catch (e) { /* already exists */ }

// Add additional photo columns to customers table
try { sqlite.exec(`ALTER TABLE customers ADD COLUMN aadhar_photo_back TEXT`) } catch (e) { /* already exists */ }
try { sqlite.exec(`ALTER TABLE customers ADD COLUMN pan_photo TEXT`) } catch (e) { /* already exists */ }
try { sqlite.exec(`ALTER TABLE customers ADD COLUMN customer_photo TEXT`) } catch (e) { /* already exists */ }

// Snapshot customer details on valuations so historical valuations remain unchanged after customer edits.
try { sqlite.exec(`ALTER TABLE valuations ADD COLUMN customer_snapshot TEXT`) } catch (e) { /* already exists */ }
try {
  const needsSnapshot = sqlite.prepare(`
    SELECT
      v.id AS valuation_id,
      c.id AS customer_id,
      c.customer_code,
      c.name,
      c.mobile,
      c.alternate_mobile,
      c.address,
      c.aadhar_number,
      c.savings_ac_no,
      c.bank_name,
      c.branch,
      c.aadhar_photo,
      c.aadhar_photo_back,
      c.pan_photo,
      c.customer_photo
    FROM valuations v
    JOIN customers c ON c.id = v.customer_id
    WHERE v.customer_snapshot IS NULL OR v.customer_snapshot = ''
  `).all()

  if (needsSnapshot.length) {
    const updateSnapshot = sqlite.prepare('UPDATE valuations SET customer_snapshot = ? WHERE id = ?')
    const tx = sqlite.transaction((rows) => {
      for (const row of rows) {
        const snapshot = {
          id: row.customer_id,
          customerCode: row.customer_code || '',
          name: row.name || '',
          mobile: row.mobile || '',
          alternateMobile: row.alternate_mobile || '',
          address: row.address || '',
          aadharNumber: row.aadhar_number || '',
          savingsAcNo: row.savings_ac_no || '',
          bankName: row.bank_name || '',
          branch: row.branch || '',
          aadharPhoto: row.aadhar_photo || '',
          aadharPhotoBack: row.aadhar_photo_back || '',
          panPhoto: row.pan_photo || '',
          customerPhoto: row.customer_photo || '',
        }
        updateSnapshot.run(JSON.stringify(snapshot), row.valuation_id)
      }
    })
    tx(needsSnapshot)
  }
} catch (e) {
  console.log('[migrate] valuation customer_snapshot backfill skipped:', e.message)
}

// Ensure ornament_master enforces one row per (user, name) so that seeding stays
// idempotent (INSERT OR IGNORE in seedDefaultsForUser relies on this constraint).
try {
  // Drop any pre-existing duplicate (user_id, name) rows first, keeping the earliest one.
  sqlite.exec(`
    DELETE FROM ornament_master
    WHERE id NOT IN (SELECT MIN(id) FROM ornament_master GROUP BY user_id, name)
  `)
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_ornament_master_user_name ON ornament_master(user_id, name)')
} catch (e) { console.log('[migrate] ornament_master unique index skipped:', e.message) }

// Backfill: ensure every ACTIVE user has the full default ornament list. This only
// inserts missing defaults and preserves user-specific additions/edits.
try {
  const activeUsers = sqlite.prepare(`
    SELECT u.id FROM users u
    WHERE u.status = 'ACTIVE'
  `).all()
  if (activeUsers.length) {
    const insertOrn = sqlite.prepare('INSERT OR IGNORE INTO ornament_master (name, user_id, created_at) VALUES (?, ?, ?)')
    const now = new Date().toISOString()
    const tx = sqlite.transaction((users) => {
      for (const u of users) {
        for (const name of DEFAULT_ORNAMENTS) insertOrn.run(name, u.id, now)
      }
    })
    tx(activeUsers)
    console.log(`[migrate] ensured default ornaments for ${activeUsers.length} active user(s)`)
  }
} catch (e) { console.log('[migrate] ornament_master backfill skipped:', e.message) }

// No demo user seeded — users must sign up.
// Default data (ornaments, series, profile, presets) is seeded per-user on signup via seedDefaultsForUser in auth.js.

console.log('[migrate] schema applied')
