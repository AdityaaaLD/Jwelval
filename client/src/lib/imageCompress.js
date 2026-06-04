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
