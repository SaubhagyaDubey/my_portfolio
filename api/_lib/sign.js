import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookieSecret } from './env.js'

// HMAC-signed values. Everything the browser holds (the pilot cookie, run tokens) is `payload.signature`,
// so the server can trust it without a database read.

const b64url = (buf) => Buffer.from(buf).toString('base64url')

function mac(purpose, payload) {
  // the purpose is mixed in so a cookie can never be replayed as a run token or vice versa
  return createHmac('sha256', cookieSecret()).update(`${purpose}\n${payload}`).digest('base64url')
}

export function sign(purpose, payload) {
  return `${payload}.${mac(purpose, payload)}`
}

export function verify(purpose, value) {
  if (typeof value !== 'string' || value.length > 2048) return null
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1))
  const want = Buffer.from(mac(purpose, payload))
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null
  return payload
}

export function randomId(bytes = 16) {
  return b64url(randomBytes(bytes))
}

// A short public handle derived from the private pilot id: lets the board mark "you" without exposing the id.
export function publicTag(pilotId) {
  return createHmac('sha256', cookieSecret()).update(`tag\n${pilotId}`).digest('base64url').slice(0, 10)
}

// Run tokens: issued when a run starts, spent when its score is submitted. Stateless; the score
// document is keyed by the run id, so a token can only ever be spent once.
const RUN = 'run'

export function issueRun(pilotId, now, city) {
  const payload = b64url(JSON.stringify({ p: pilotId, r: randomId(12), t: now, c: city }))
  return sign(RUN, payload)
}

export function readRun(token) {
  const payload = verify(RUN, token)
  if (!payload) return null
  try {
    const { p, r, t, c } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof p !== 'string' || typeof r !== 'string' || typeof t !== 'number') return null
    return { pilotId: p, runId: r, startedAt: t, city: c === 'top' ? 'top' : 'under' }
  } catch {
    return null
  }
}
