import { create } from 'zustand'
import { today } from '../lib/format'

export const REMARK_OPTIONS = [
  'No defect',
  'Crack in jewellery',
  'Pieces/stones missing',
  'Jewellery is bent',
  'Solder marks visible',
  'Others',
]

const blankItem = () => ({
  description: '',
  noOfUnits: 1,
  purityCarat: 22,
  purityPercent: 91.67,
  grossWeightGm: '',
  netWeightGm: '',
  approxValueInr: 0,
  remarks: '',
  remarksCustom: '',
})

const initialForm = () => ({
  customerId: '',
  seriesId: '',
  valuationDate: today(),
  branch: '',
  branchCode: '',
  acNo: '',
  applicationId: '',
  bankPresetId: '',
  loanLtv: 57,
  goldRate22k: '',
  loanAmount: '',
  bankRecommendedValue: '',
  valuationFee: '',
  rateOfInterest: '',
  loanType: '',
  personPhoto: '',
  jewelleryPhoto: '',
  ornamentPhotos: [],
  aadharPhotoDoc: '',
  panPhoto: '',
  certificateRules: '',
  items: [blankItem()],
})

const n = (value) => Number(value) || 0
const round = (value, digits = 2) => +value.toFixed(digits)

export const deriveItem = (item, goldRate22k) => {
  const netWeightGm = n(item.netWeightGm)
  const purityCarat = n(item.purityCarat) || 22
  const purityPercent = round((purityCarat / 24) * 100, 2)
  const net24kGoldGm = round(netWeightGm * (purityPercent / 100), 4)
  const net22kGoldGm = round(net24kGoldGm * (24 / 22), 4)
  // Value scaled by entered karat against 22K rate
  const approxValueInr = round(n(goldRate22k) * (purityCarat / 22) * netWeightGm, 2)
  return {
    ...item,
    noOfUnits: parseInt(item.noOfUnits, 10) || 1,
    purityPercent,
    purityCarat,
    grossWeightGm: item.grossWeightGm,
    netWeightGm: item.netWeightGm,
    net24kGoldGm,
    net22kGoldGm,
    approxValueInr,
  }
}

const deriveForm = (form) => {
  const goldRate22k = n(form.goldRate22k)
  const items = form.items.map((item) => deriveItem(item, goldRate22k))
  const marketValue = round(items.reduce((sum, item) => sum + n(item.approxValueInr), 0), 2)
  const ltv = (n(form.loanLtv) || 57) / 100
  const ltvLoan = round(marketValue * ltv, 2)
  const bankVal = n(form.bankRecommendedValue)
  let suggestedLoan = ltvLoan
  if (bankVal > 0) suggestedLoan = Math.min(ltvLoan, bankVal)
  return {
    ...form,
    items,
    marketValue,
    suggestedLoan,
  }
}

export const useValuationStore = create((set, get) => ({
  form: deriveForm(initialForm()),
  dirty: false,
  reset: () => set({ form: deriveForm(initialForm()), dirty: false }),
  hydrate: (valuation) => set({
    form: deriveForm({
      customerId: valuation.customerId || '',
      seriesId: valuation.seriesId || '',
      valuationDate: valuation.valuationDate || today(),
      branch: valuation.branch || '',
      branchCode: valuation.branchCode || '',
      acNo: valuation.acNo || '',
      applicationId: valuation.applicationId || '',
      bankPresetId: valuation.bankPresetId || '',
      loanLtv: valuation.loanLtv || 57,
      goldRate22k: valuation.goldRate22k || '',
      loanAmount: valuation.loanAmount || '',
      bankRecommendedValue: valuation.bankRecommendedValue || '',
      valuationFee: valuation.valuationFee || '',
      rateOfInterest: valuation.rateOfInterest || '',
      loanType: valuation.loanType || '',
      personPhoto: valuation.personPhoto || '',
      jewelleryPhoto: valuation.jewelleryPhoto || '',
      ornamentPhotos: valuation.ornamentPhotos || [],
      aadharPhotoDoc: valuation.aadharPhotoDoc || '',
      panPhoto: valuation.panPhoto || '',
      certificateRules: valuation.certificateRules || '',
      items: (valuation.items?.length ? valuation.items : [blankItem()]).map((item) => ({
        description: item.description || '',
        noOfUnits: item.noOfUnits || 1,
        purityCarat: item.purityCarat || 22,
        purityPercent: item.purityPercent || 91.67,
        grossWeightGm: item.grossWeightGm || '',
        netWeightGm: item.netWeightGm || '',
        approxValueInr: item.approxValueInr || 0,
        remarks: item.remarks || '',
        remarksCustom: item.remarksCustom || '',
      })),
    }),
    dirty: false,
  }),
  setField: (field, value) => set((state) => ({
    form: deriveForm({ ...state.form, [field]: value }),
    dirty: true,
  })),
  setItem: (index, field, value) => set((state) => {
    const items = state.form.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    return { form: deriveForm({ ...state.form, items }), dirty: true }
  }),
  addItem: () => set((state) => ({
    form: deriveForm({ ...state.form, items: [...state.form.items, blankItem()] }),
    dirty: true,
  })),
  removeItem: (index) => set((state) => ({
    form: deriveForm({ ...state.form, items: state.form.items.filter((_, i) => i !== index) }),
    dirty: true,
  })),
  markClean: () => set({ dirty: false }),
  payload: () => {
    const form = get().form
    return {
      customerId: Number(form.customerId),
      seriesId: Number(form.seriesId),
      valuationDate: form.valuationDate,
      branch: form.branch,
      branchCode: form.branchCode,
      acNo: form.acNo,
      applicationId: form.applicationId,
      bankPresetId: form.bankPresetId ? Number(form.bankPresetId) : null,
      goldRate22k: Number(form.goldRate22k),
      goldRate24k: +(Number(form.goldRate22k) * 24 / 22).toFixed(2),
      loanAmount: Number(form.loanAmount),
      bankRecommendedValue: form.bankRecommendedValue !== '' ? Number(form.bankRecommendedValue) : null,
      valuationFee: Number(form.valuationFee) || 0,
      rateOfInterest: form.rateOfInterest === '' ? null : Number(form.rateOfInterest),
      loanType: form.loanType || '',
      personPhoto: form.personPhoto || '',
      jewelleryPhoto: form.jewelleryPhoto || '',
      ornamentPhotos: form.ornamentPhotos || [],
      aadharPhotoDoc: form.aadharPhotoDoc || '',
      panPhoto: form.panPhoto || '',
      certificateRules: form.certificateRules || '',
      items: form.items.map((item) => ({
        description: item.description,
        noOfUnits: Number(item.noOfUnits) || 1,
        purityPercent: Number(item.purityPercent) || 0,
        purityCarat: Number(item.purityCarat) || 22,
        grossWeightGm: Number(item.grossWeightGm) || 0,
        netWeightGm: Number(item.netWeightGm) || 0,
        remarks: item.remarks === 'Others' ? (item.remarksCustom || '') : (item.remarks || ''),
      })),
    }
  },
}))
