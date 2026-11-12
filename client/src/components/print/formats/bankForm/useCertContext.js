import { useEffect, useState } from 'react'
import { api } from '../../../../lib/api'
import '@fontsource/arimo/400.css'
import '@fontsource/arimo/500.css'
import '@fontsource/arimo/600.css'
import '@fontsource/arimo/700.css'

/* Shared data loading for the bank-form templates. Mirrors what the Standard
   certificate loads (profile, bank preset, QR base URL, fonts, signed pages)
   without touching the Standard component. `loaded` turns true only when
   everything that changes the layout is known, so pagination measures once. */

const CERT_FONT_WEIGHTS = ['400', '500', '600', '700']
let fontsPromise = null
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = typeof document !== 'undefined' && document.fonts?.load
      ? Promise.all(CERT_FONT_WEIGHTS.map((w) => document.fonts.load(`${w} 12px Arimo`, 'Aa1₹'))).then(() => true, () => true)
      : Promise.resolve(true)
  }
  return fontsPromise
}

const norm = (value) => String(value || '').trim().toLowerCase()

export function findBankPreset(rows, valuation) {
  const presetId = Number(valuation?.bankPresetId)
  const byId = presetId ? rows.find((row) => Number(row.id) === presetId) : null
  if (byId) return byId
  const wantedBank = norm(valuation?.customer?.bankName)
  if (!wantedBank) return null
  const wantedBranch = norm(valuation?.branch || valuation?.customer?.branch)
  return rows.find((row) => norm(row.bankName) === wantedBank && (wantedBranch ? norm(row.branch) === wantedBranch : true)) || null
}

export default function useCertContext(valuation, { qrBaseUrl = '', includeKyc = true } = {}) {
  const [profile, setProfile] = useState(undefined)
  const [bankPreset, setBankPreset] = useState(undefined)
  const [qrBase, setQrBase] = useState(() => String(qrBaseUrl || '').trim() || undefined)
  const [fontsReady, setFontsReady] = useState(false)
  const signedCount = includeKyc ? Number(valuation?.signedPageCount) || 0 : 0
  const [signedPages, setSignedPages] = useState(() => (signedCount ? null : []))

  useEffect(() => {
    let alive = true
    api.profile.get()
      .then((data) => { if (alive) setProfile(data || {}) })
      .catch(() => { if (alive) setProfile({}) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    api.presets.banks()
      .then((rows) => { if (alive) setBankPreset(findBankPreset(rows || [], valuation)) })
      .catch(() => { if (alive) setBankPreset(null) })
    return () => { alive = false }
  }, [valuation?.bankPresetId, valuation?.branch, valuation?.customer?.bankName, valuation?.customer?.branch])

  useEffect(() => {
    const explicit = String(qrBaseUrl || '').trim()
    if (explicit) {
      setQrBase(explicit)
      return undefined
    }
    let alive = true
    api.verifyBaseUrl()
      .then((data) => { if (alive) setQrBase(String(data?.baseUrl || '').trim()) })
      .catch(() => { if (alive) setQrBase('') })
    return () => { alive = false }
  }, [qrBaseUrl])

  useEffect(() => {
    let alive = true
    loadFonts().then(() => { if (alive) setFontsReady(true) })
    return () => { alive = false }
  }, [])

  // Bank-signed copy pages: own records only (preview/print), never the shared PDF.
  useEffect(() => {
    if (!signedCount) {
      setSignedPages([])
      return undefined
    }
    let alive = true
    setSignedPages(null)
    api.valuations.signedPages.list(valuation.id)
      .then((data) => { if (alive) setSignedPages(data.pages || []) })
      .catch(() => { if (alive) setSignedPages([]) })
    return () => { alive = false }
  }, [valuation?.id, signedCount])

  return {
    profile: profile || {},
    bankPreset: bankPreset || null,
    qrBase: qrBase || '',
    signedPages: signedPages || [],
    loaded: profile !== undefined && bankPreset !== undefined && qrBase !== undefined && fontsReady,
    signedLoaded: signedPages !== null,
  }
}
