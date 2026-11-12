import { useLayoutEffect, useRef, useState } from 'react'

/*
 * Measured A4 pagination for the bank-form templates (the same approach as the
 * Standard certificate, kept separate so Standard is never affected).
 *
 * Page 1:  firstHead + table head + rows
 * Page 2+: contHead  + table head + rows
 * Last:    … + total row + footer (declarations / signatures)
 * Every page ends with a small page-number line.
 *
 * Geometry must match `.print-page.digital-cert.bf-page` in bankForms.css.
 */
const PAGE_HEIGHT_MM = 296.9
const PAGE_PAD_Y_MM = 15 // 8mm top + 7mm bottom
const mmToPx = (mm) => (mm * 96) / 25.4
const SAFETY_PX = 6
const USABLE_PX = mmToPx(PAGE_HEIGHT_MM - PAGE_PAD_Y_MM) - SAFETY_PX
const MAX_RETRIES = 5

function allImagesReady(root) {
  return Array.from(root.querySelectorAll('img')).every((img) => img.complete)
}

function onImagesSettled(root, callback) {
  const pending = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete)
  if (!pending.length) return () => {}
  let done = false
  const fire = () => {
    if (done) return
    done = true
    callback()
  }
  pending.forEach((img) => {
    img.addEventListener('load', fire, { once: true })
    img.addEventListener('error', fire, { once: true })
  })
  return () => pending.forEach((img) => {
    img.removeEventListener('load', fire)
    img.removeEventListener('error', fire)
  })
}

const sum = (list, heights) => list.reduce((acc, i) => acc + heights[i], 0)

export function paginate({ rowHeights, firstHeadH, contHeadH, theadH, blankH, totalH, footerH, pageNoH, minRows, usable }) {
  const cap1 = usable - firstHeadH - theadH - pageNoH
  const capN = usable - contHeadH - theadH - pageNoH
  const lastExtra = totalH + footerH
  const pages = []
  let current = []
  let used = 0
  let cap = cap1
  rowHeights.forEach((height, index) => {
    if (current.length && used + height > cap) {
      pages.push(current)
      current = []
      used = 0
      cap = capN
    }
    current.push(index)
    used += height
  })

  if (used + lastExtra > cap && current.length) {
    // Move only the minimum trailing rows so the total + footer fit on the last page.
    const moved = []
    while (current.length && used + lastExtra > cap) {
      const index = current.pop()
      used -= rowHeights[index]
      moved.unshift(index)
      if (sum(moved, rowHeights) + lastExtra <= capN) break
    }
    if (current.length || !pages.length) pages.push(current)
    pages.push(moved)
    if (!pages[0].length && pages.length > 1 && moved.length) {
      // Nothing stayed on page 1: put the moved rows there instead of an empty page.
      pages.splice(0, 2, moved)
    }
  } else {
    pages.push(current)
  }

  const lastIndex = pages.length - 1
  const lastCap = lastIndex === 0 ? cap1 : capN
  const free = lastCap - sum(pages[lastIndex], rowHeights) - lastExtra
  const wanted = Math.max(0, minRows - rowHeights.length)
  const blanks = blankH > 0 ? Math.max(0, Math.min(wanted, Math.floor(free / blankH))) : 0
  return { pages, blanks }
}

export default function PagedForm({
  ready,
  signature,
  pageClassName = '',
  firstHead,
  contHead,
  colGroup,
  tableHead,
  rows,
  blankRow,
  minRows = 0,
  totalRow,
  footer,
  pageLabel,
  trailing,
  trailingReady = true,
}) {
  const measureRef = useRef(null)
  const pagesRef = useRef(null)
  const [plan, setPlan] = useState(null)
  const [tick, setTick] = useState(0)
  const [extraSafety, setExtraSafety] = useState(0)
  const [verified, setVerified] = useState(false)
  const retriesRef = useRef(0)
  const qrWaitRef = useRef(0)

  useLayoutEffect(() => {
    retriesRef.current = 0
    qrWaitRef.current = 0
    setExtraSafety(0)
    setPlan(null)
    setVerified(false)
  }, [signature])

  useLayoutEffect(() => {
    if (plan || !ready) return undefined
    const root = measureRef.current
    if (!root) return undefined
    if (!allImagesReady(root)) return onImagesSettled(root, () => setTick((value) => value + 1))

    const sheet = root.querySelector('article')
    const scale = sheet.getBoundingClientRect().width / sheet.offsetWidth || 1
    const height = (node) => (node ? node.getBoundingClientRect().height / scale : 0)
    const rowNodes = Array.from(root.querySelectorAll('tbody > tr.bf-row'))
    setPlan(paginate({
      rowHeights: rowNodes.map(height),
      firstHeadH: height(root.querySelector('.bf-head-first')),
      contHeadH: height(root.querySelector('.bf-head-cont')),
      theadH: height(root.querySelector('thead')),
      blankH: height(root.querySelector('tr.bf-blank-row')),
      totalH: height(root.querySelector('tr.bf-total-row')),
      footerH: height(root.querySelector('.bf-footer')),
      pageNoH: height(root.querySelector('.bf-page-no')),
      minRows,
      usable: USABLE_PX - extraSafety,
    }))
    return undefined
  }, [plan, ready, tick, extraSafety, rows, minRows])

  // Safety net: if any sheet still overflows (e.g. sub-pixel drift), re-paginate with more slack.
  // Also wait until every QR code has been drawn, so "ready" means fully painted.
  useLayoutEffect(() => {
    if (!plan || verified || !pagesRef.current) return undefined
    if (pagesRef.current.querySelector('.bf-qr div.bf-qr-img') && qrWaitRef.current < 100) {
      qrWaitRef.current += 1
      const timer = setTimeout(() => setTick((value) => value + 1), 50)
      return () => clearTimeout(timer)
    }
    const overflowing = Array.from(pagesRef.current.querySelectorAll('article.bf-page'))
      .some((sheet) => sheet.scrollHeight > sheet.clientHeight + 1)
    if (overflowing && retriesRef.current < MAX_RETRIES) {
      retriesRef.current += 1
      setExtraSafety((value) => value + 18)
      setPlan(null)
      return undefined
    }
    setVerified(true)
    return undefined
  }, [plan, verified, tick])

  const pageCount = plan ? plan.pages.length : 1
  const renderSheet = (pageIndex, rowIndexes, { isLast, blanks, measuring = false }) => (
    <article
      key={measuring ? 'measure' : `bf-page-${pageIndex}`}
      className={`print-page digital-cert bf-page ${pageClassName}${measuring ? ' bf-measure-page' : ''}`}
    >
      {(measuring || pageIndex === 0) && <div className="bf-head bf-head-first">{firstHead}</div>}
      {(measuring || pageIndex > 0) && <div className="bf-head bf-head-cont">{contHead}</div>}
      <table className="bf-table">
        {colGroup}
        {tableHead}
        <tbody>
          {rowIndexes.map((index) => rows[index])}
          {Array.from({ length: blanks }, (_, i) => blankRow(`blank-${i}`))}
          {isLast && totalRow}
        </tbody>
      </table>
      {isLast && <div className="bf-footer">{footer}</div>}
      <p className="bf-page-no">{pageLabel(pageIndex + 1, measuring ? 1 : pageCount)}</p>
    </article>
  )

  const done = Boolean(plan) && verified
  return (
    <div ref={pagesRef} data-format-ready={done && trailingReady ? 'true' : 'false'}>
      {/* Pages are sized by us, so the printed sheet itself has no margin. */}
      <style data-format-page-rule="true">{'@page { size: A4; margin: 0; }'}</style>

      {!plan && (
        <div className="dc-measure" ref={measureRef} aria-hidden="true">
          {renderSheet(0, rows.map((_, i) => i), { isLast: true, blanks: 1, measuring: true })}
        </div>
      )}

      {plan && plan.pages.map((rowIndexes, pageIndex) => renderSheet(pageIndex, rowIndexes, {
        isLast: pageIndex === plan.pages.length - 1,
        blanks: pageIndex === plan.pages.length - 1 ? plan.blanks : 0,
      }))}

      {plan && trailing}
    </div>
  )
}
