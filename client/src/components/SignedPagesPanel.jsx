import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, CheckCircle2, ImagePlus, Lock, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { formatDateDMY } from '../lib/format'
import ImageCropModal from './ImageCropModal'

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('Failed to read image file'))
  reader.readAsDataURL(file)
})

/**
 * Photos of the bank-signed report, attached to a finalized valuation.
 * Pages can be added/removed freely until the appraiser confirms them;
 * after "Confirm & Lock" they are permanent. They appear after the KYC sheet
 * in preview/print only — never in the shared PDF.
 */
export default function SignedPagesPanel({ valuation, onCountChange, onLocked }) {
  const valuationId = valuation?.id
  const [pages, setPages] = useState([])
  const [lockedAt, setLockedAt] = useState(valuation?.signedPagesLockedAt || null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [queue, setQueue] = useState([])
  const [session, setSession] = useState(null)
  const [viewer, setViewer] = useState(null)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  useEffect(() => {
    if (!valuationId) return undefined
    let alive = true
    setLoading(true)
    api.valuations.signedPages.list(valuationId)
      .then((data) => {
        if (!alive) return
        setPages(data.pages || [])
        setLockedAt(data.lockedAt || null)
      })
      .catch(() => { if (alive) toast.error('Unable to load signed pages.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [valuationId])

  const updatePages = useCallback((next) => {
    setPages(next)
    onCountChange?.(next.length)
  }, [onCountChange])

  // Open the next queued photo in the rotate-only editor, one page at a time.
  useEffect(() => {
    if (session || !queue.length) return
    const [file, ...rest] = queue
    setQueue(rest)
    // Reserve the editor slot synchronously so the next queued file waits its turn.
    setSession({ src: '', name: file.name })
    readFileAsDataUrl(file)
      .then((src) => setSession({ src, name: file.name }))
      .catch(() => {
        setSession(null)
        toast.error('Unable to open that photo.')
      })
  }, [queue, session])

  const pickFiles = (event) => {
    const files = Array.from(event.target.files || []).filter((f) => f.type.startsWith('image/'))
    event.target.value = ''
    if (!files.length) return
    setQueue((current) => [...current, ...files])
  }

  const uploadPage = async (dataUrl) => {
    setBusy(true)
    try {
      const page = await api.valuations.signedPages.add(valuationId, dataUrl)
      updatePages([...pages, { ...page, image: dataUrl }])
      toast.success(`Signed page ${page.pageNo} added.`)
      setSession(null)
    } catch (error) {
      toast.error(error.message || 'Unable to add this page. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const removePage = async (page) => {
    if (!window.confirm(`Remove signed page ${page.pageNo}?`)) return
    setBusy(true)
    try {
      const { pages: remaining } = await api.valuations.signedPages.remove(valuationId, page.id)
      const images = Object.fromEntries(pages.map((p) => [p.id, p.image]))
      updatePages(remaining.map((p) => ({ ...p, image: images[p.id] })))
      toast.success('Page removed.')
    } catch (error) {
      toast.error(error.message || 'Unable to remove this page.')
    } finally {
      setBusy(false)
    }
  }

  const confirmAndLock = async () => {
    if (!pages.length) return toast.error('Add at least one signed page first.')
    const ok = window.confirm(
      `Confirm ${pages.length} signed page${pages.length > 1 ? 's' : ''}?\n\nAfter confirming, these pages are locked permanently and cannot be removed or changed.`
    )
    if (!ok) return
    setBusy(true)
    try {
      const updated = await api.valuations.signedPages.lock(valuationId)
      setLockedAt(updated.signedPagesLockedAt)
      onLocked?.(updated)
      toast.success('Signed pages confirmed and locked.')
    } catch (error) {
      toast.error(error.message || 'Unable to lock signed pages.')
    } finally {
      setBusy(false)
    }
  }

  const locked = Boolean(lockedAt)
  const pendingCount = queue.length + (session ? 1 : 0)

  return (
    <div className="sheet">
      <div className="sheet-strip">
        <span className="sheet-title">Signed Report Pages{pages.length ? ` (${pages.length})` : ''}</span>
        {locked && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <Lock size={12} /> Locked {formatDateDMY(lockedAt)}
          </span>
        )}
      </div>
      <div className="sheet-body space-y-3">
        <p className="text-xs text-slate-500">
          {locked
            ? 'These signed pages are confirmed. They print after the KYC page and are never included in the shared PDF.'
            : 'Photograph each page of the report signed by the bank. Pages print after the KYC page (not in the shared PDF). You can remove and re-add pages until you confirm.'}
        </p>

        {loading ? (
          <p className="text-xs text-slate-400">Loading signed pages…</p>
        ) : pages.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {pages.map((page) => (
              <div key={page.id} className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <button type="button" className="block w-full" onClick={() => setViewer(page)} aria-label={`View signed page ${page.pageNo}`}>
                  {page.image
                    ? <img src={page.image} alt={`Signed page ${page.pageNo}`} className="h-32 w-full object-contain p-1" />
                    : <div className="grid h-32 place-items-center text-xs text-slate-400">Page {page.pageNo}</div>}
                </button>
                <span className="absolute left-1 top-1 rounded bg-ink-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">Page {page.pageNo}</span>
                {!locked && (
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-white/95 p-1 text-red-600 shadow disabled:opacity-50"
                    onClick={() => removePage(page)}
                    disabled={busy}
                    aria-label={`Remove signed page ${page.pageNo}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!locked && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => cameraRef.current?.click()} disabled={busy}>
              <Camera size={16} /> Take Photo
            </button>
            <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => galleryRef.current?.click()} disabled={busy}>
              <ImagePlus size={16} /> From Gallery
            </button>
            <button type="button" className="btn-primary w-full sm:ml-auto sm:w-auto" onClick={confirmAndLock} disabled={busy || !pages.length || pendingCount > 0}>
              <CheckCircle2 size={16} /> Confirm &amp; Lock Pages
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={pickFiles} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" onChange={pickFiles} />
          </div>
        )}
        {pendingCount > 1 && <p className="text-xs text-slate-500">{pendingCount} photos waiting to be added…</p>}
      </div>

      <ImageCropModal
        open={Boolean(session?.src)}
        title={`Signed Page ${pages.length + 1}`}
        src={session?.src || ''}
        rotateOnly
        onCancel={() => { if (!busy) setSession(null) }}
        onApply={uploadPage}
      />

      {viewer && (
        <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-slate-950/90" onClick={() => setViewer(null)}>
          <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
            <span className="text-sm font-semibold">Signed page {viewer.pageNo}</span>
            <button type="button" className="rounded p-1 hover:bg-white/10" aria-label="Close"><X size={20} /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <img src={viewer.image} alt={`Signed page ${viewer.pageNo}`} className="mx-auto max-h-full w-auto max-w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
