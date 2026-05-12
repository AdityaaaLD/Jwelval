import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerCode: text('customer_code').notNull().unique(),
  name: text('name').notNull(),
  address: text('address'),
  mobile: text('mobile'),
  aadharNumber: text('aadhar_number'),
  aadharPhoto: text('aadhar_photo'),
  savingsAcNo: text('savings_ac_no'),
  bankName: text('bank_name'),
  branch: text('branch'),
  createdAt: text('created_at').notNull(),
})

export const valuationSeries = sqliteTable('valuation_series', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seriesName: text('series_name').notNull(),
  prefix: text('prefix').notNull(),
  currentNumber: integer('current_number').notNull().default(0),
  numberOfDigits: integer('number_of_digits').notNull().default(4),
  formatType: text('format_type').notNull(), // RUSHIKESH | DNYANESHWARI | BANK_OF_MAHA
  createdAt: text('created_at').notNull(),
})

export const valuations = sqliteTable('valuations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  valuationNumber: text('valuation_number').notNull().unique(),
  seriesId: integer('series_id')
    .notNull()
    .references(() => valuationSeries.id),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  formatType: text('format_type').notNull(),
  valuationDate: text('valuation_date').notNull(),
  acNo: text('ac_no'),
  branch: text('branch'),
  goldRate22k: real('gold_rate_22k').notNull().default(0),
  goldRate24k: real('gold_rate_24k').notNull().default(0),
  marketValue: real('market_value').notNull().default(0),
  loanAmount: real('loan_amount').notNull().default(0),
  valuationFee: real('valuation_fee').notNull().default(0),
  rateOfInterest: real('rate_of_interest'),
  personPhoto: text('person_photo'),
  jewelleryPhoto: text('jewellery_photo'),
  ornamentPhotos: text('ornament_photos'),
  applicationId: text('application_id'),
  branchCode: text('branch_code'),
  status: text('status').notNull().default('DRAFT'), // DRAFT | PRINTED | LOCKED
  printedAt: text('printed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const dailyRates = sqliteTable('daily_rates', {
  rateDate: text('rate_date').primaryKey(),
  goldRate22k: real('gold_rate_22k').notNull().default(0),
  goldRate24k: real('gold_rate_24k').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const appraiserProfile = sqliteTable('appraiser_profile', {
  id: integer('id').primaryKey(),
  appraiserName: text('appraiser_name'),
  businessName: text('business_name'),
  mobile: text('mobile'),
  email: text('email'),
  upiId: text('upi_id'),
  logoPhoto: text('logo_photo'),
  address: text('address'),
  empanelmentId: text('empanelment_id'),
  gstn: text('gstn'),
  updatedAt: text('updated_at'),
})

export const bankPresets = sqliteTable('bank_presets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bankName: text('bank_name').notNull(),
  branch: text('branch').notNull(),
  rateOfInterest: real('rate_of_interest'),
  loanLtv: real('loan_ltv'),
  managerName: text('manager_name'),
  address: text('address'),
  createdAt: text('created_at').notNull(),
})

export const valuationItems = sqliteTable('valuation_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  valuationId: integer('valuation_id')
    .notNull()
    .references(() => valuations.id, { onDelete: 'cascade' }),
  srNo: integer('sr_no').notNull(),
  description: text('description'),
  noOfUnits: integer('no_of_units').notNull().default(1),
  purityPercent: real('purity_percent').notNull().default(0),
  purityCarat: real('purity_carat').notNull().default(0),
  grossWeightGm: real('gross_weight_gm').notNull().default(0),
  netWeightGm: real('net_weight_gm').notNull().default(0),
  net24kGoldGm: real('net_24k_gold_gm').notNull().default(0),
  net22kGoldGm: real('net_22k_gold_gm').notNull().default(0),
  approxValueInr: real('approx_value_inr').notNull().default(0),
  digitalId: text('digital_id'),
})

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  valuationId: integer('valuation_id')
    .notNull()
    .references(() => valuations.id, { onDelete: 'cascade' }),
  paymentDate: text('payment_date').notNull(),
  amount: real('amount').notNull(),
  mode: text('mode').notNull(), // RECEIVABLE_FROM_BANK | CASH | UPI
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
})
