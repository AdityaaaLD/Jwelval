import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { logEvent, logErrorEvent } from './logger.js'

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  '--no-zygote',
  '--font-render-hinting=none',
]

const CANDIDATE_BINARIES = [
  'chromium',
  'chromium-browser',
  'google-chrome-stable',
  'google-chrome',
]

const CANDIDATE_PATHS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]

const NAV_TIMEOUT_MS = Number(process.env.PDF_NAV_TIMEOUT_MS || 45000)
const READY_TIMEOUT_MS = Number(process.env.PDF_READY_TIMEOUT_MS || 40000)
const MAX_CONCURRENCY = Math.max(1, Number(process.env.PDF_MAX_CONCURRENCY || 2))

let puppeteerPromise = null
let browserPromise = null
let resolvedExecutablePath
let active = 0
const waiters = []

function whichSync(binary) {
  const finder = process.platform === 'win32' ? 'where' : 'which'
  try {
    const out = execFileSync(finder, [binary], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    return out[0] || null
  } catch {
    return null
  }
}

function resolveExecutablePath(puppeteer) {
  if (resolvedExecutablePath !== undefined) return resolvedExecutablePath

  const configured = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim()
  if (configured && existsSync(configured)) {
    resolvedExecutablePath = configured
    return resolvedExecutablePath
  }

  for (const binary of CANDIDATE_BINARIES) {
    const found = whichSync(binary)
    if (found && existsSync(found)) {
      resolvedExecutablePath = found
      return resolvedExecutablePath
    }
  }

  for (const candidate of CANDIDATE_PATHS) {
    if (existsSync(candidate)) {
      resolvedExecutablePath = candidate
      return resolvedExecutablePath
    }
  }

  // Fall back to the Chromium that puppeteer downloaded during install, if any.
  try {
    const bundled = puppeteer.executablePath()
    if (bundled && existsSync(bundled)) {
      resolvedExecutablePath = bundled
      return resolvedExecutablePath
    }
  } catch {
    // puppeteer has no bundled browser in this environment
  }

  resolvedExecutablePath = null
  return resolvedExecutablePath
}

async function loadPuppeteer() {
  if (!puppeteerPromise) {
    puppeteerPromise = import('puppeteer')
      .then((mod) => mod.default || mod)
      .catch((error) => {
        puppeteerPromise = null
        const wrapped = new Error('PDF engine is not installed on the server.')
        wrapped.code = 'PDF_ENGINE_MISSING'
        wrapped.cause = error
        throw wrapped
      })
  }
  return puppeteerPromise
}

async function launchBrowser() {
  const puppeteer = await loadPuppeteer()
  const executablePath = resolveExecutablePath(puppeteer)
  if (!executablePath) {
    const error = new Error('No Chromium/Chrome browser found on the server for PDF generation.')
    error.code = 'PDF_BROWSER_MISSING'
    throw error
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: LAUNCH_ARGS,
  })
  logEvent('PDF_BROWSER_LAUNCHED', { executablePath })

  browser.on('disconnected', () => {
    logEvent('PDF_BROWSER_DISCONNECTED', {})
    browserPromise = null
  })

  return browser
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null
      throw error
    })
  }
  const browser = await browserPromise
  if (!browser.connected) {
    browserPromise = null
    return getBrowser()
  }
  return browser
}

function acquireSlot() {
  if (active < MAX_CONCURRENCY) {
    active += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => waiters.push(resolve))
}

function releaseSlot() {
  const next = waiters.shift()
  if (next) {
    next()
    return
  }
  active = Math.max(0, active - 1)
}

/**
 * Renders an authenticated app URL to PDF using the real Chrome print engine,
 * so the output is identical to the browser's "Print / Save as PDF".
 */
export async function renderUrlToPdf({ url, authToken, waitForReadyAttribute = 'data-print-ready' }) {
  await acquireSlot()
  const browser = await getBrowser().catch((error) => {
    releaseSlot()
    throw error
  })

  let page = null
  try {
    page = await browser.newPage()
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 })
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS)
    page.setDefaultTimeout(NAV_TIMEOUT_MS)

    if (authToken) {
      const origin = new URL(url).origin
      await page.evaluateOnNewDocument((token) => {
        try { window.localStorage.setItem('jewelval_token', token) } catch { /* storage blocked */ }
      }, authToken)
      // Ensure localStorage is scoped to the app origin before the SPA boots.
      await page.goto(`${origin}/favicon.ico`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    }

    await page.goto(url, { waitUntil: 'networkidle0' })

    await page.waitForFunction(
      (readyAttr, errorAttr) => {
        const body = document.body
        if (!body) return false
        if (body.getAttribute(errorAttr)) return true
        return body.getAttribute(readyAttr) === 'true'
      },
      { timeout: READY_TIMEOUT_MS, polling: 200 },
      waitForReadyAttribute,
      'data-print-error'
    )

    const renderError = await page.evaluate(() => document.body.getAttribute('data-print-error'))
    if (renderError) {
      const error = new Error(`Report could not be rendered: ${renderError}`)
      error.code = 'PDF_RENDER_FAILED'
      throw error
    }

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    })

    const pdf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    if (pdf.length < 1024) {
      const error = new Error('Generated PDF was empty.')
      error.code = 'PDF_EMPTY'
      throw error
    }
    return pdf
  } finally {
    if (page) await page.close().catch(() => {})
    releaseSlot()
  }
}

export async function shutdownPdfRenderer() {
  if (!browserPromise) return
  try {
    const browser = await browserPromise
    await browser.close()
  } catch (error) {
    logErrorEvent('PDF_BROWSER_SHUTDOWN_FAILED', error)
  } finally {
    browserPromise = null
  }
}
