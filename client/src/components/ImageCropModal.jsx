import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

const ASPECT_OPTIONS = [
  { label: 'Document (4:3)', value: 4 / 3 },
  { label: 'Portrait (3:4)', value: 3 / 4 },
  { label: 'Square (1:1)', value: 1 },
  { label: 'Wide (16:9)', value: 16 / 9 },
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export default function ImageCropModal({
  open,
  title = 'Adjust Image',
  src,
  onCancel,
  onApply,
}) {
  const imageRef = useRef(null)
  const frameRef = useRef(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })
  const [aspect, setAspect] = useState(4 / 3)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!open) return
    setAspect(4 / 3)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [open, src])

  useEffect(() => {
    if (!open || !frameRef.current) return undefined

    const update = () => {
      const rect = frameRef.current.getBoundingClientRect()
      setFrameSize({ width: rect.width, height: rect.height })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(frameRef.current)
    window.addEventListener('resize', update)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [open, aspect])

  const baseScale = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height || !frameSize.width || !frameSize.height) return 1
    return Math.max(frameSize.width / naturalSize.width, frameSize.height / naturalSize.height)
  }, [naturalSize, frameSize])

  const displaySize = useMemo(() => {
    const width = naturalSize.width * baseScale * zoom
    const height = naturalSize.height * baseScale * zoom
    return { width, height }
  }, [naturalSize, baseScale, zoom])

  const maxOffset = useMemo(() => ({
    x: Math.max(0, (displaySize.width - frameSize.width) / 2),
    y: Math.max(0, (displaySize.height - frameSize.height) / 2),
  }), [displaySize, frameSize])

  useEffect(() => {
    setOffset((prev) => ({
      x: clamp(prev.x, -maxOffset.x, maxOffset.x),
      y: clamp(prev.y, -maxOffset.y, maxOffset.y),
    }))
  }, [maxOffset.x, maxOffset.y])

  const applyCrop = async () => {
    if (!imageRef.current || !frameSize.width || !frameSize.height) return
    try {
      setApplying(true)
      const ratio = frameSize.height / frameSize.width
      const canvasWidth = 1200
      const canvasHeight = Math.max(1, Math.round(canvasWidth * ratio))
      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const frameToCanvas = canvasWidth / frameSize.width
      const drawWidth = displaySize.width * frameToCanvas
      const drawHeight = displaySize.height * frameToCanvas
      const drawX = (canvasWidth - drawWidth) / 2 + (offset.x * frameToCanvas)
      const drawY = (canvasHeight - drawHeight) / 2 + (offset.y * frameToCanvas)

      ctx.drawImage(imageRef.current, drawX, drawY, drawWidth, drawHeight)
      const out = canvas.toDataURL('image/jpeg', 0.9)
      await onApply(out)
    } finally {
      setApplying(false)
    }
  }

  const applyOriginal = async () => {
    try {
      setApplying(true)
      await onApply(src)
    } finally {
      setApplying(false)
    }
  }

  if (!open || !src) return null

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-3xl items-center justify-center">
        <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button type="button" className="btn-ghost" onClick={onCancel} disabled={applying}>
              <X size={18} />
            </button>
          </div>

          <img
            ref={imageRef}
            src={src}
            alt="Crop source"
            className="hidden"
            onLoad={(e) => {
              setNaturalSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
            }}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div
              ref={frameRef}
              className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-md bg-slate-200"
              style={{ aspectRatio: String(aspect) }}
              onPointerDown={(e) => {
                if (applying) return
                e.currentTarget.setPointerCapture(e.pointerId)
                setDragging(true)
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId)
                setDragging(false)
              }}
              onPointerCancel={() => setDragging(false)}
              onPointerMove={(e) => {
                if (!dragging || applying) return
                setOffset((prev) => ({
                  x: clamp(prev.x + e.movementX, -maxOffset.x, maxOffset.x),
                  y: clamp(prev.y + e.movementY, -maxOffset.y, maxOffset.y),
                }))
              }}
            >
              <img
                src={src}
                alt="Crop preview"
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: `${displaySize.width}px`,
                  height: `${displaySize.height}px`,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  touchAction: 'none',
                }}
                draggable={false}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Frame</label>
              <select className="input" value={String(aspect)} onChange={(e) => setAspect(Number(e.target.value))} disabled={applying}>
                {ASPECT_OPTIONS.map((opt) => (
                  <option key={opt.label} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Zoom ({zoom.toFixed(2)}x)</label>
              <input
                type="range"
                min="1"
                max="4"
                step="0.01"
                className="w-full"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                disabled={applying}
              />
            </div>
            <div>
              <label className="label">Horizontal Position</label>
              <input
                type="range"
                min={-maxOffset.x}
                max={maxOffset.x}
                step="1"
                className="w-full"
                value={offset.x}
                onChange={(e) => setOffset((prev) => ({ ...prev, x: Number(e.target.value) }))}
                disabled={applying || maxOffset.x === 0}
              />
            </div>
            <div>
              <label className="label">Vertical Position</label>
              <input
                type="range"
                min={-maxOffset.y}
                max={maxOffset.y}
                step="1"
                className="w-full"
                value={offset.y}
                onChange={(e) => setOffset((prev) => ({ ...prev, y: Number(e.target.value) }))}
                disabled={applying || maxOffset.y === 0}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={applying}>Cancel</button>
            <button type="button" className="btn-secondary" onClick={applyOriginal} disabled={applying}>Use Original</button>
            <button type="button" className="btn-primary" onClick={applyCrop} disabled={applying}>
              <Check size={16} /> {applying ? 'Applying...' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
