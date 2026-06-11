const region = process.env.AWS_REGION || 'us-east-1'
const fromEmail = process.env.EMAIL_FROM || 'no-reply@example.com'
const configuredProvider = String(process.env.MAIL_PROVIDER || 'auto').trim().toLowerCase()
const hasSesCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
const hasSendGridKey = Boolean(process.env.SENDGRID_API_KEY)

let resolvedProvider = null
let resolvedProviderName = null

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, '')
const asList = (to) => (Array.isArray(to) ? to : [to])

function sendStubEmail({ to, subject, html, text }) {
  console.log('[mailer:stub]', {
    to,
    subject,
    preview: text || stripHtml(html).slice(0, 160),
  })
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
  if (resolvedProvider) return { send: resolvedProvider, name: resolvedProviderName }

  if (configuredProvider === 'stub') {
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
  return { send: resolvedProvider, name: resolvedProviderName }
}

export async function sendEmail(payload) {
  const provider = await resolveProvider()
  await provider.send(payload)
}

export function getMailerProvider() {
  return resolvedProviderName || configuredProvider
}
