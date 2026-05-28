import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerCode: text('customer_code').notNull().unique(),
  name: text('name').notNull(),
  address: text('address'),
  mobile: text('mobile'),
  alternateMobile: text('alternate_mobile'),
  aadharNumber: text('aadhar_number'),
  aadharPhoto: text('aadhar_photo'),
  aadharPhotoBack: text('aadhar_photo_back'),
  savingsAcNo: text('savings_ac_no'),
  bankName: text('bank_name'),
  branch: text('branch'),
  userId: integer('user_id').notNull().default(1),
  createdAt: text('created_at').notNull(),
})

export const valuationSeries = sqliteTable('valuation_series', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seriesName: text('series_name').notNull(),
  prefix: text('prefix').notNull(),
  currentNumber: integer('current_number').notNull().default(0),
  numberOfDigits: integer('number_of_digits').notNull().default(4),
  formatType: text('format_type').notNull(), // RUSHIKESH | DNYANESHWARI | BANK_OF_MAHA | DIGITAL_CERT
  userId: integer('user_id').notNull().default(1),
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
  loanType: text('loan_type'),
  personPhoto: text('person_photo'),
  jewelleryPhoto: text('jewellery_photo'),
  ornamentPhotos: text('ornament_photos'),
  applicationId: text('application_id'),
  branchCode: text('branch_code'),
  aadharPhotoDoc: text('aadhar_photo_doc'),
  panPhoto: text('pan_photo'),
  status: text('status').notNull().default('DRAFT'), // DRAFT | PRINTED | LOCKED
  printedAt: text('printed_at'),
  createdAt: text('created_at').notNull(),
  userId: integer('user_id').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
})

export const dailyRates = sqliteTable('daily_rates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rateDate: text('rate_date').notNull(),
  goldRate22k: real('gold_rate_22k').notNull().default(0),
  goldRate24k: real('gold_rate_24k').notNull().default(0),
  userId: integer('user_id').notNull().default(1),
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
  userId: integer('user_id'),
  updatedAt: text('updated_at'),
})

export const bankPresets = sqliteTable('bank_presets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bankName: text('bank_name').notNull(),
  branch: text('branch').notNull(),
  branchCode: text('branch_code'),
  rateOfInterest: real('rate_of_interest'),
  loanLtv: real('loan_ltv'),
  managerName: text('manager_name'),
  address: text('address'),
  appIdPrefix: text('app_id_prefix'),
  appIdCurrentNumber: integer('app_id_current_number').notNull().default(0),
  appIdDigits: integer('app_id_digits').notNull().default(10),
  userId: integer('user_id').notNull().default(1),
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

export const ornamentMaster = sqliteTable('ornament_master', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  userId: integer('user_id').notNull().default(1),
  createdAt: text('created_at').notNull(),
})

export const billSeries = sqliteTable('bill_series', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seriesName: text('series_name').notNull(),
  prefix: text('prefix').notNull(),
  currentNumber: integer('current_number').notNull().default(0),
  numberOfDigits: integer('number_of_digits').notNull().default(3),
  userId: integer('user_id').notNull().default(1),
  createdAt: text('created_at').notNull(),
})

export const sellBills = sqliteTable('sell_bills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  billNumber: text('bill_number').notNull().unique(),
  billSeriesId: integer('bill_series_id').references(() => billSeries.id),
  valuationId: integer('valuation_id').references(() => valuations.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  billDate: text('bill_date').notNull(),
  orderNo: text('order_no'),
  chequeNo: text('cheque_no'),
  chequeDate: text('cheque_date'),
  bank: text('bank'),
  bankBranch: text('bank_branch'),
  subtotal: real('subtotal').notNull().default(0),
  gstPercent: real('gst_percent').notNull().default(3),
  gstAmount: real('gst_amount').notNull().default(0),
  total: real('total').notNull().default(0),
  advance: real('advance').notNull().default(0),
  balance: real('balance').notNull().default(0),
  userId: integer('user_id').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sellBillItems = sqliteTable('sell_bill_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  billId: integer('bill_id').notNull().references(() => sellBills.id, { onDelete: 'cascade' }),
  srNo: integer('sr_no').notNull(),
  particular: text('particular'),
  karatPurity: text('karat_purity'),
  pcs: integer('pcs').notNull().default(1),
  grossWeight: real('gross_weight').notNull().default(0),
  netWeight: real('net_weight').notNull().default(0),
  rate: real('rate').notNull().default(0),
  making: real('making').notNull().default(0),
  amount: real('amount').notNull().default(0),
})
