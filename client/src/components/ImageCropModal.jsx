import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, RotateCw, X } from 'lucide-react'

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
  preserveFullImage = false,
}) {
  const imageRef = useRef(null)
  const frameRef = useRef(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })
  const [aspect, setAspect] = useState(4 / 3)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!open) return
    setAspect(4 / 3)
    setZoom(1)
    setRotation(0)
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
    const quarterTurns = ((rotation % 360) + 360) % 360 / 90
    const isSwap = quarterTurns % 2 === 1
    const sourceWidth = isSwap ? naturalSize.height : naturalSize.width
    const sourceHeight = isSwap ? naturalSize.width : naturalSize.height
    const scaleX = frameSize.width / sourceWidth
    const scaleY = frameSize.height / sourceHeight
    return preserveFullImage ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY)
  }, [naturalSize, frameSize, rotation, preserveFullImage])

  const displaySize = useMemo(() => {
    const width = naturalSize.width * baseScale * zoom
    const height = naturalSize.height * baseScale * zoom
    return { width, height }
  }, [naturalSize, baseScale, zoom])

  const rotatedBounds = useMemo(() => {
    const quarterTurns = ((rotation % 360) + 360) % 360 / 90
    const isSwap = quarterTurns % 2 === 1
    return {
      width: isSwap ? displaySize.height : displaySize.width,
      height: isSwap ? displaySize.width : displaySize.height,
    }
  }, [displaySize, rotation])

  const maxOffset = useMemo(() => ({
    x: Math.max(0, (rotatedBounds.width - frameSize.width) / 2),
    y: Math.max(0, (rotatedBounds.height - frameSize.height) / 2),
  }), [rotatedBounds, frameSize])

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
      const centerX = canvasWidth / 2 + (offset.x * frameToCanvas)
      const centerY = canvasHeight / 2 + (offset.y * frameToCanvas)

      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.drawImage(imageRef.current, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
      ctx.restore()
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
    <div className="fixed inset-0 z-[100] h-[100dvh] overflow-hidden bg-slate-900/70 backdrop-blur-sm sm:p-4">
      <div className="mx-auto flex h-full max-w-3xl items-stretch justify-center sm:items-center">
        <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl sm:border sm:border-slate-200">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
            <button type="button" className="btn-ghost" onClick={onCancel} disabled={applying} aria-label="Close image editor">
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:p-3">
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
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg)`,
                  touchAction: 'none',
                }}
                draggable={false}
              />
            </div>
          </div>
          {preserveFullImage && (
            <p className="mt-2 text-center text-xs font-medium text-slate-600">The complete jewellery photo will be preserved. Empty frame space will remain white.</p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Rotate</label>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setRotation((r) => (r + 270) % 360)} disabled={applying}>
                  <RotateCcw size={16} /> Left
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setRotation((r) => (r + 90) % 360)} disabled={applying}>
                  <RotateCw size={16} /> Right
                </button>
              </div>
            </div>
            <div>
              <label className="label">Frame</label>
              <select className="input" value={String(aspect)} onChange={(e) => setAspect(Number(e.target.value))} disabled={applying}>
                {ASPECT_OPTIONS.map((opt) => (
                  <option key={opt.label} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
            </div>
            {!preserveFullImage && (
              <>
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
              </>
            )}
          </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-3 py-3 sm:flex-row sm:justify-end sm:px-5">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={applying}>Cancel</button>
            <button type="button" className="btn-secondary" onClick={applyOriginal} disabled={applying}>Use Original</button>
            <button type="button" className="btn-primary" onClick={applyCrop} disabled={applying}>
              <Check size={16} /> {applying ? 'Applying...' : preserveFullImage ? 'Use Full Photo' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
