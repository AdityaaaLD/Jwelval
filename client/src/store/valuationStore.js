import { create } from 'zustand'
import { today } from '../lib/format'

const blankItem = () => ({
  description: '',
  noOfUnits: 1,
  purityPercent: 86,
  purityCarat: 20.64,
  grossWeightGm: '',
  netWeightGm: '',
  net24kGoldGm: 0,
  net22kGoldGm: 0,
  approxValueInr: 0,
})

const initialForm = () => ({
  customerId: '',
  seriesId: '',
  valuationDate: today(),
  branch: '',
  acNo: '',
  goldRate22k: '',
  goldRate24k: '',
  loanAmount: '',
  valuationFee: '',
  rateOfInterest: '',
  personPhoto: '',
  jewelleryPhoto: '',
  ornamentPhotos: [],
  items: [blankItem()],
})

const n = (value) => Number(value) || 0
const round = (value, digits = 2) => +value.toFixed(digits)

export const deriveItem = (item, goldRate22k) => {
  const purityPercent = n(item.purityPercent)
  const netWeightGm = n(item.netWeightGm)
  const purityCarat = round(purityPercent * 24 / 100, 4)
  const net24kGoldGm = round(netWeightGm * (purityPercent / 100), 4)
  const net22kGoldGm = round(net24kGoldGm * (24 / 22), 4)
  return {
    ...item,
    noOfUnits: parseInt(item.noOfUnits, 10) || 1,
    purityPercent,
    purityCarat,
    grossWeightGm: item.grossWeightGm,
    netWeightGm: item.netWeightGm,
    net24kGoldGm,
    net22kGoldGm,
    approxValueInr: round(net22kGoldGm * n(goldRate22k), 2),
  }
}

const deriveForm = (form, keepLoan = false) => {
  const goldRate22k = n(form.goldRate22k)
  const items = form.items.map((item) => deriveItem(item, goldRate22k))
  const marketValue = round(items.reduce((sum, item) => sum + n(item.approxValueInr), 0), 2)
  return {
    ...form,
    goldRate24k: form.goldRate24k || (goldRate22k ? round(goldRate22k * 24 / 22, 2) : ''),
    items,
    marketValue,
    loanAmount: keepLoan && form.loanAmount !== '' ? form.loanAmount : round(marketValue * 0.57, 2),
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
      acNo: valuation.acNo || '',
      goldRate22k: valuation.goldRate22k || '',
      goldRate24k: valuation.goldRate24k || '',
      loanAmount: valuation.loanAmount || '',
      valuationFee: valuation.valuationFee || '',
      rateOfInterest: valuation.rateOfInterest || '',
      personPhoto: valuation.personPhoto || '',
      jewelleryPhoto: valuation.jewelleryPhoto || '',
      ornamentPhotos: valuation.ornamentPhotos || [],
      items: (valuation.items?.length ? valuation.items : [blankItem()]).map((item) => ({
        description: item.description || '',
        noOfUnits: item.noOfUnits || 1,
        purityPercent: item.purityPercent || 0,
        purityCarat: item.purityCarat || 0,
        grossWeightGm: item.grossWeightGm || '',
        netWeightGm: item.netWeightGm || '',
        net24kGoldGm: item.net24kGoldGm || 0,
        net22kGoldGm: item.net22kGoldGm || 0,
        approxValueInr: item.approxValueInr || 0,
      })),
    }, true),
    dirty: false,
  }),
  setField: (field, value) => set((state) => ({
    form: deriveForm({ ...state.form, [field]: value }, field === 'loanAmount'),
    dirty: true,
  })),
  setItem: (index, field, value) => set((state) => {
    const items = state.form.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    return { form: deriveForm({ ...state.form, items }, true), dirty: true }
  }),
  addItem: () => set((state) => ({
    form: deriveForm({ ...state.form, items: [...state.form.items, blankItem()] }, true),
    dirty: true,
  })),
  removeItem: (index) => set((state) => ({
    form: deriveForm({ ...state.form, items: state.form.items.filter((_, i) => i !== index) }, true),
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
      acNo: form.acNo,
      goldRate22k: Number(form.goldRate22k),
      goldRate24k: Number(form.goldRate24k),
      loanAmount: Number(form.loanAmount),
      valuationFee: Number(form.valuationFee) || 0,
      rateOfInterest: form.rateOfInterest === '' ? null : Number(form.rateOfInterest),
      personPhoto: form.personPhoto || '',
      jewelleryPhoto: form.jewelleryPhoto || '',
      ornamentPhotos: form.ornamentPhotos || [],
      items: form.items.map((item) => ({
        description: item.description,
        noOfUnits: Number(item.noOfUnits) || 1,
        purityPercent: Number(item.purityPercent) || 0,
        grossWeightGm: Number(item.grossWeightGm) || 0,
        netWeightGm: Number(item.netWeightGm) || 0,
      })),
    }
  },
}))
