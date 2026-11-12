import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { sellBillFormat } from '../components/print/formats'

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

function imagesSettled(root) {
  const images = Array.from(root.querySelectorAll('img'))
  if (!images.length) return true
  return images.every((img) => img.complete && (img.naturalWidth > 0 || img.getAttribute('src') === ''))
}

async function waitForSelector(selector, { timeoutMs = 20000, intervalMs = 100 } = {}) {
  if (!selector) return true
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (document.querySelector(selector)) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

async function waitForStableRender(root, { timeoutMs = 20000, stableChecks = 3, intervalMs = 120 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastSignature = ''
  let stable = 0
  while (Date.now() < deadline) {
    const signature = `${root.querySelectorAll('img').length}:${root.scrollHeight}:${imagesSettled(root)}`
    if (signature === lastSignature && imagesSettled(root)) {
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

export default function SellBillRender() {
  const { id } = useParams()
  const [bill, setBill] = useState(null)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    let cancelled = false
    api.sellBills
      .get(id)
      .then((data) => {
        if (cancelled) return
        if (!data) throw new Error('SELL_BILL_NOT_FOUND')
        setBill(data)
      })
      .catch((error) => {
        if (cancelled) return
        setFailed(error?.message || 'SELL_BILL_LOAD_FAILED')
        markError(error?.message || 'SELL_BILL_LOAD_FAILED')
      })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!bill) return undefined
    let cancelled = false
    const format = sellBillFormat(bill.printFormat)
    const run = async () => {
      const root = document.getElementById('print-portal') || document.body
      await waitForStableRender(root)
      await waitForFonts()
      await waitForSelector(format.readySelector)
      // one extra frame so late layout/paint work is flushed before capture
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 120)))
      if (!cancelled) markReady()
    }
    run()
    return () => { cancelled = true }
  }, [bill])

  if (failed) {
    return <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>Unable to load sell bill: {failed}</div>
  }
  if (!bill) return null
  const { Component } = sellBillFormat(bill.printFormat)

  return createPortal(
    <div id="print-portal" className="print-overlay">
      <div className="print-preview-scroll">
        <div className="print-preview-center">
          <Component bill={bill} options={bill.printFormatOptions} />
        </div>
      </div>
    </div>,
    document.body
  )
}
