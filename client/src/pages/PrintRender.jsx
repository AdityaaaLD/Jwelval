import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { valuationFormat } from '../components/print/formats'

const READY_ATTR = 'data-print-ready'
const ERROR_ATTR = 'data-print-error'

function markReady() {
  document.body.setAttribute(READY_ATTR, 'true')
}

function markError(message) {
  document.body.setAttribute(ERROR_ATTR, message || 'PRINT_RENDER_FAILED')
}

async function waitForFonts() {
  if (!document.fonts?.ready) return
  try {
    await document.fonts.ready
  } catch {
    // font loading is best-effort only
  }
}

// The certificate paginates itself after fonts/images load; capture only then.
async function waitForPagination({ selector, timeoutMs = 20000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (document.querySelector(selector)) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

async function waitForPageRule({ selector, timeoutMs = 8000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (document.querySelector(selector)) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

// `allowEmpty`: a layout that may legitimately have no images (QR/photos
// switched off) must not wait for one. The Standard layout always has a QR.
function imagesSettled(root, allowEmpty = false) {
  const images = Array.from(root.querySelectorAll('img'))
  if (!images.length) return allowEmpty
  return images.every((img) => img.complete && (img.naturalWidth > 0 || img.getAttribute('src') === ''))
}

async function waitForStableRender(root, { timeoutMs = 25000, stableChecks = 3, intervalMs = 120, allowEmpty = false } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastSignature = ''
  let stable = 0
  while (Date.now() < deadline) {
    const signature = `${root.querySelectorAll('img').length}:${root.scrollHeight}:${imagesSettled(root, allowEmpty)}`
    if (signature === lastSignature && imagesSettled(root, allowEmpty)) {
      stable += 1
      if (stable >= stableChecks) return true
    } else {
      stable = 0
      lastSignature = signature
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

export default function PrintRender() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  // The shared/bank copy is rendered with ?kyc=0 so the KYC sheet is left out.
  const includeKyc = searchParams.get('kyc') !== '0'
  const qrBaseUrl = searchParams.get('qrBase') || ''
  const reportAt = searchParams.get('reportAt') || ''
  const [valuation, setValuation] = useState(null)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    let cancelled = false
    api.valuations
      .get(id)
      .then((data) => {
        if (cancelled) return
        if (!data) throw new Error('VALUATION_NOT_FOUND')
        setValuation(data)
      })
      .catch((error) => {
        if (cancelled) return
        setFailed(error?.message || 'VALUATION_LOAD_FAILED')
        markError(error?.message || 'VALUATION_LOAD_FAILED')
      })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!valuation) return undefined
    let cancelled = false
    const format = valuationFormat(valuation.printFormat)
    const run = async () => {
      const root = document.getElementById('print-portal') || document.body
      const allowEmpty = Boolean(format.allowNoImages)
      await waitForStableRender(root, { allowEmpty })
      await waitForPageRule({ selector: format.pageRuleSelector })
      await waitForFonts()
      await waitForPagination({ selector: format.readySelector })
      await waitForStableRender(root, { allowEmpty })
      // one extra frame so late layout/paint work is flushed before capture
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 120)))
      if (!cancelled) markReady()
    }
    run()
    return () => { cancelled = true }
  }, [valuation])

  if (failed) {
    return <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>Unable to load valuation: {failed}</div>
  }
  if (!valuation) return null
  const { Component } = valuationFormat(valuation.printFormat)

  return createPortal(
    <div id="print-portal" className="print-overlay">
      <div className="print-preview-scroll">
        <div className="print-preview-center">
          <Component
            valuation={valuation}
            includeKyc={includeKyc}
            qrBaseUrl={qrBaseUrl}
            reportAt={reportAt}
            options={valuation.printFormatOptions}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
