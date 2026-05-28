// Business rules from the spec:
//   purity_carat   = purity_percent * 24 / 100
//   net_24k_gold   = net_weight * (purity_percent / 100)
//   net_22k_gold   = net_24k * (24 / 22)
//   approx_value   = net_22k_gold * gold_rate_22k

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function deriveItem(item, goldRate22k) {
  const grossWeightGm = num(item.grossWeightGm)
  const netWeightGm = num(item.netWeightGm)
  const noOfUnits = Number.isInteger(item.noOfUnits) ? item.noOfUnits : parseInt(item.noOfUnits, 10) || 1

  // Fixed 22K: purity = 91.67%, carat = 22
  const purityPercent = 91.67
  const purityCarat = 22
  const net24kGoldGm = +(netWeightGm * (purityPercent / 100)).toFixed(4)
  const net22kGoldGm = +(netWeightGm).toFixed(4)
  // Value = 22K rate × net weight
  const approxValueInr = +(num(goldRate22k) * netWeightGm).toFixed(2)

  return {
    description: item.description || '',
    noOfUnits,
    purityPercent,
    purityCarat,
    grossWeightGm,
    netWeightGm,
    net24kGoldGm,
    net22kGoldGm,
    approxValueInr,
  }
}

export function totalsFromItems(derived) {
  return derived.reduce(
    (acc, it) => {
      acc.marketValue += it.approxValueInr
      acc.gross += it.grossWeightGm
      acc.net += it.netWeightGm
      acc.gold24 += it.net24kGoldGm
      acc.gold22 += it.net22kGoldGm
      return acc
    },
    { marketValue: 0, gross: 0, net: 0, gold24: 0, gold22: 0 }
  )
}

// RBI gold-loan LTV norm = 75% (cap). Spec uses 0.57 as a conservative recommendation.
export const LOAN_LTV = 0.57
