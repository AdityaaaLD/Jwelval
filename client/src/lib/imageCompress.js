/**
 * Compress and resize an image file before upload.
 * Returns a base64 data URL (JPEG).
 *
 * @param {File|Blob} file - The image file to compress
 * @param {object} opts - Options
 * @param {number} opts.maxWidth - Max width in px (default 500)
 * @param {number} opts.maxHeight - Max height in px (default 500)
 * @param {number} opts.quality - JPEG quality 0-1 (default 0.25)
 * @returns {Promise<string>} base64 data URL
 */
export function compressImage(file, opts = {}) {
  const { maxWidth = 500, maxHeight = 500, quality = 0.25 } = opts
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        // Scale down if needed
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Normalize logos to a consistent canvas size so print layout is stable across
 * different uploaded logo dimensions.
 *
 * @param {File|Blob} file
 * @param {object} opts
 * @param {number} opts.targetWidth
 * @param {number} opts.targetHeight
 * @param {number} opts.quality
 * @param {string} opts.background
 * @param {number} opts.paddingPercent - 0..0.4
 * @returns {Promise<string>} normalized JPEG data URL
 */
/**
 * Find the bounding box of the "real" logo content by ignoring a uniform
 * (usually white) or transparent border baked into the uploaded file. Returns
 * source-pixel coordinates, or the full image if nothing distinct is found.
 */
function findContentBounds(img, { tolerance = 26 } = {}) {
  // Analyse at a bounded resolution to keep memory/CPU sane on big uploads.
  const maxDim = 900
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const work = document.createElement('canvas')
  work.width = w
  work.height = h
  const wctx = work.getContext('2d', { willReadFrequently: true })
  wctx.drawImage(img, 0, 0, w, h)

  let data
  try {
    data = wctx.getImageData(0, 0, w, h).data
  } catch {
    return { x: 0, y: 0, width: img.width, height: img.height }
  }

  // Background reference = average of the four corners.
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]
  let br = 0, bg = 0, bb = 0
  for (const [cx, cy] of corners) {
    const i = (cy * w + cx) * 4
    br += data[i]; bg += data[i + 1]; bb += data[i + 2]
  }
  br /= 4; bg /= 4; bb /= 4

  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      const a = data[i + 3]
      const isContent = a < 16
        ? false // fully transparent = background
        : (Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb) > tolerance) || a < 250
      if (isContent) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: img.width, height: img.height }
  }

  const inv = 1 / scale
  return {
    x: Math.max(0, Math.floor(minX * inv)),
    y: Math.max(0, Math.floor(minY * inv)),
    width: Math.min(img.width, Math.ceil((maxX - minX + 1) * inv)),
    height: Math.min(img.height, Math.ceil((maxY - minY + 1) * inv)),
  }
}

export function normalizeLogoImage(file, opts = {}) {
  const {
    targetWidth = 1000,
    targetHeight = 280,
    quality = 0.88,
    background = '#ffffff',
    paddingPercent = 0.08,
    trim = true,
  } = opts

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')

        // Crop away any uniform/transparent border so the mark fills the box.
        const bounds = trim
          ? findContentBounds(img)
          : { x: 0, y: 0, width: img.width, height: img.height }

        const pad = Math.max(0, Math.min(0.4, Number(paddingPercent) || 0))
        const innerW = targetWidth * (1 - pad * 2)
        const innerH = targetHeight * (1 - pad * 2)
        const scale = Math.min(innerW / bounds.width, innerH / bounds.height)
        const drawW = Math.max(1, Math.round(bounds.width * scale))
        const drawH = Math.max(1, Math.round(bounds.height * scale))
        const dx = Math.round((targetWidth - drawW) / 2)
        const dy = Math.round((targetHeight - drawH) / 2)

        ctx.fillStyle = background
        ctx.fillRect(0, 0, targetWidth, targetHeight)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(
          img,
          bounds.x, bounds.y, bounds.width, bounds.height,
          dx, dy, drawW, drawH,
        )
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Failed to load logo image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read logo image'))
    reader.readAsDataURL(file)
  })
}

/**
 * Compress a base64 data URL string (for re-compressing existing images).
 * @param {string} dataUrl - Existing base64 data URL
 * @param {object} opts - Same as compressImage opts
 * @returns {Promise<string>} compressed base64 data URL
 */
export function compressDataUrl(dataUrl, opts = {}) {
  const { maxWidth = 500, maxHeight = 500, quality = 0.25 } = opts
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image for compression'))
    img.src = dataUrl
  })
}
