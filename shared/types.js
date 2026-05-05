/**
 * @typedef {Object} ValuationItem
 * @property {string} description
 * @property {string} metal
 * @property {number|string} grossWeight
 * @property {number|string} netWeight
 * @property {number|string} ratePerGram
 * @property {number|string} makingCharges
 */

/**
 * @typedef {Object} Valuation
 * @property {string} id
 * @property {string} certificateNo
 * @property {string} customerName
 * @property {string} customerAddress
 * @property {string} purpose
 * @property {number} totalValue
 * @property {string} createdAt    // ISO date (yyyy-mm-dd)
 * @property {ValuationItem[]} [items]
 */

export {}
