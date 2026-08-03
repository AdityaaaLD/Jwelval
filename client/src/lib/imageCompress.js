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
export function normalizeLogoImage(file, opts = {}) {
  const {
    targetWidth = 1000,
    targetHeight = 280,
    quality = 0.88,
    background = '#ffffff',
    paddingPercent = 0.08,
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

        const pad = Math.max(0, Math.min(0.4, Number(paddingPercent) || 0))
        const innerW = targetWidth * (1 - pad * 2)
        const innerH = targetHeight * (1 - pad * 2)
        const scale = Math.min(innerW / img.width, innerH / img.height)
        const drawW = Math.max(1, Math.round(img.width * scale))
        const drawH = Math.max(1, Math.round(img.height * scale))
        const dx = Math.round((targetWidth - drawW) / 2)
        const dy = Math.round((targetHeight - drawH) / 2)

        ctx.fillStyle = background
        ctx.fillRect(0, 0, targetWidth, targetHeight)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, dx, dy, drawW, drawH)
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
