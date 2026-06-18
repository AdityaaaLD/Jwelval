import { logEvent, logErrorEvent } from './lib/logger.js'

const region = process.env.AWS_REGION || 'us-east-1'
const fromEmail = process.env.EMAIL_FROM || 'no-reply@example.com'
const configuredProvider = String(process.env.MAIL_PROVIDER || 'auto').trim().toLowerCase()
const hasSesCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
const hasSendGridKey = Boolean(process.env.SENDGRID_API_KEY)
const isProd = process.env.NODE_ENV === 'production'
const allowStubInProd = String(process.env.ALLOW_STUB_MAILER_IN_PROD || '').trim() === 'true'

let resolvedProvider = null
let resolvedProviderName = null
const MAX_RETRIES = Number(process.env.MAIL_SEND_MAX_RETRIES || 3)
const BASE_BACKOFF_MS = Number(process.env.MAIL_SEND_BACKOFF_MS || 400)
const TEST_FAILURE_SEQUENCE = String(process.env.MAIL_TEST_FAILURE_SEQUENCE || '').trim()
const TEST_TIMEOUT_MS = Number(process.env.MAIL_TEST_TIMEOUT_MS || 0)
let testFailureCursor = 0

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, '')
const asList = (to) => (Array.isArray(to) ? to : [to])
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function getMailErrorStatus(error) {
  return error?.code || error?.statusCode || error?.response?.statusCode || error?.response?.status
}

async function maybeSimulateTestFailure() {
  if (!TEST_FAILURE_SEQUENCE) return
  const sequence = TEST_FAILURE_SEQUENCE.split(',').map((x) => x.trim()).filter(Boolean)
  if (!sequence.length) return

  const token = sequence[Math.min(testFailureCursor, sequence.length - 1)]
  testFailureCursor += 1

  if (token === 'OK') return
  if (token === 'TIMEOUT') {
    const ms = TEST_TIMEOUT_MS > 0 ? TEST_TIMEOUT_MS : 1500
    await sleep(ms)
    const err = new Error('Simulated timeout from MAIL_TEST_FAILURE_SEQUENCE')
    err.code = 'ETIMEDOUT'
    throw err
  }

  const statusCode = Number(token)
  if (Number.isFinite(statusCode) && statusCode > 0) {
    const err = new Error(`Simulated mail failure status ${statusCode}`)
    err.statusCode = statusCode
    throw err
  }
}

function isRetryableMailError(error) {
  const status = Number(getMailErrorStatus(error))
  if (status === 429) return true
  if (status >= 500 && status < 600) return true
  const message = String(error?.message || '').toLowerCase()
  return message.includes('timeout') || message.includes('econnreset') || message.includes('temporar')
}

function ensureMailerConfigValid() {
  if (!fromEmail || !fromEmail.includes('@')) {
    const error = new Error('EMAIL_FROM is required and must be a valid email address.')
    error.code = 'MAILER_CONFIG_INVALID'
    throw error
  }

  if (configuredProvider === 'sendgrid' && !hasSendGridKey) {
    const error = new Error('MAIL_PROVIDER=sendgrid requires SENDGRID_API_KEY.')
    error.code = 'MAILER_CONFIG_INVALID'
    throw error
  }

  if (configuredProvider === 'ses' && !hasSesCreds) {
    const error = new Error('MAIL_PROVIDER=ses requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.')
    error.code = 'MAILER_CONFIG_INVALID'
    throw error
  }

  if (isProd && configuredProvider === 'auto' && !hasSendGridKey && !hasSesCreds && !allowStubInProd) {
    const error = new Error('MAIL_PROVIDER=auto has no provider credentials in production and stub mailer is disabled.')
    error.code = 'MAILER_CONFIG_INVALID'
    throw error
  }
}

function sendStubEmail({ to, subject, html, text }) {
  logEvent('MAIL_STUB_SENT', {
    to,
    subject,
    preview: '[redacted]',
    bodyLength: (text || stripHtml(html) || '').length,
  })
}

function assertStubAllowed() {
  if (isProd && !allowStubInProd) {
    const err = new Error('Stub mailer is disabled in production. Configure MAIL_PROVIDER and provider credentials.')
    err.code = 'MAILER_PROVIDER_REQUIRED'
    err.status = 503
    throw err
  }
}

async function buildSesProvider() {
  if (!hasSesCreds) throw new Error('Missing AWS SES credentials')
  const sdk = await import('@aws-sdk/client-ses')
  const ses = new sdk.SESClient({ region })
  const SendEmailCommand = sdk.SendEmailCommand
  return async ({ to, subject, html, text }) => {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: asList(to),
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          ...(html ? { Html: { Data: html } } : {}),
          Text: { Data: text || stripHtml(html) || '' },
        },
      },
    })
    await ses.send(command)
  }
}

async function buildSendGridProvider() {
  if (!hasSendGridKey) throw new Error('Missing SENDGRID_API_KEY')
  const sendGridModule = await import('@sendgrid/mail')
  const sendGridMail = sendGridModule.default || sendGridModule
  sendGridMail.setApiKey(process.env.SENDGRID_API_KEY)

  return async ({ to, subject, html, text }) => {
    await sendGridMail.send({
      to: asList(to),
      from: fromEmail,
      subject,
      text: text || stripHtml(html) || '',
      ...(html ? { html } : {}),
    })
  }
}

async function resolveProvider() {
  ensureMailerConfigValid()
  if (resolvedProvider) return { send: resolvedProvider, name: resolvedProviderName }

  if (configuredProvider === 'stub') {
    assertStubAllowed()
    resolvedProvider = sendStubEmail
    resolvedProviderName = 'stub'
    return { send: resolvedProvider, name: resolvedProviderName }
  }

  if (configuredProvider === 'sendgrid') {
    resolvedProvider = await buildSendGridProvider()
    resolvedProviderName = 'sendgrid'
    return { send: resolvedProvider, name: resolvedProviderName }
  }

  if (configuredProvider === 'ses') {
    resolvedProvider = await buildSesProvider()
    resolvedProviderName = 'ses'
    return { send: resolvedProvider, name: resolvedProviderName }
  }

  if (configuredProvider !== 'auto') {
    throw new Error(`Invalid MAIL_PROVIDER "${configuredProvider}". Use auto|sendgrid|ses|stub.`)
  }

  if (hasSendGridKey) {
    try {
      resolvedProvider = await buildSendGridProvider()
      resolvedProviderName = 'sendgrid'
      return { send: resolvedProvider, name: resolvedProviderName }
    } catch (error) {
      console.warn('[mailer] SendGrid unavailable in auto mode:', error.message)
    }
  }

  if (hasSesCreds) {
    try {
      resolvedProvider = await buildSesProvider()
      resolvedProviderName = 'ses'
      return { send: resolvedProvider, name: resolvedProviderName }
    } catch (error) {
      console.warn('[mailer] SES unavailable in auto mode:', error.message)
    }
  }

  resolvedProvider = sendStubEmail
  resolvedProviderName = 'stub'
  assertStubAllowed()
  return { send: resolvedProvider, name: resolvedProviderName }
}

export async function sendEmail(payload) {
  const provider = await resolveProvider()
  let attempt = 0
  while (attempt < MAX_RETRIES) {
    attempt += 1
    try {
      await maybeSimulateTestFailure()
      await provider.send(payload)
      logEvent('OTP_SENT', { provider: provider.name, attempt, to: payload?.to })
      return
    } catch (error) {
      const status = getMailErrorStatus(error)
      const retryable = isRetryableMailError(error)
      logErrorEvent('OTP_FAILED', error, { provider: provider.name, attempt, status, retryable, to: payload?.to })
      if (!retryable || attempt >= MAX_RETRIES) throw error
      const backoff = BASE_BACKOFF_MS * (2 ** (attempt - 1))
      await sleep(backoff)
    }
  }
}

export function getMailerProvider() {
  return resolvedProviderName || configuredProvider
}

export function getMailerHealth() {
  ensureMailerConfigValid()
  const configured = configuredProvider === 'auto'
    ? (hasSendGridKey || hasSesCreds || allowStubInProd || !isProd)
    : configuredProvider === 'sendgrid'
      ? hasSendGridKey
      : configuredProvider === 'ses'
        ? hasSesCreds
        : configuredProvider === 'stub'
          ? (!isProd || allowStubInProd)
          : false

  return {
    provider: getMailerProvider(),
    configured,
    fromEmail,
  }
}

export function validateMailerConfiguration() {
  ensureMailerConfigValid()
  return true
}
