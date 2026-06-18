const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error'])

function serializeError(error) {
  if (!error) return undefined
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    status: error.status,
    stack: error.stack,
  }
}

export function logEvent(event, payload = {}, level = 'info') {
  const finalLevel = LOG_LEVELS.has(level) ? level : 'info'
  const body = {
    ts: new Date().toISOString(),
    level: finalLevel,
    event,
    ...payload,
  }

  const line = JSON.stringify(body)
  if (finalLevel === 'error') {
    console.error(line)
    return
  }
  if (finalLevel === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export function logErrorEvent(event, error, payload = {}) {
  logEvent(event, {
    ...payload,
    error: serializeError(error),
  }, 'error')
}
