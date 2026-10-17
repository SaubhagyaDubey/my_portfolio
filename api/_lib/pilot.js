import { createHash } from 'node:crypto'
import { randomId, sign, verify } from './sign.js'

// The browser account: a random pilot id in a signed, HttpOnly cookie. No sign-up, no password;
// clearing cookies starts a new pilot.

export const COOKIE = 'df_pilot'
const PURPOSE = 'pilot'
const MAX_AGE = 400 * 24 * 60 * 60 // browsers cap cookie lifetime at 400 days
const ID_RE = /^[A-Za-z0-9_-]{22}$/

export function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k || k in out) continue
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim())
    } catch {
      // malformed value; ignore it
    }
  }
  return out
}

// The pilot id from the request's cookie, or null when there is none or it was tampered with.
export function pilotFrom(request) {
  const value = parseCookies(request.headers.get('cookie'))[COOKIE]
  const id = verify(PURPOSE, value)
  return id && ID_RE.test(id) ? id : null
}

export function newPilotId() {
  return randomId(16) // 22 base64url chars
}

export function pilotCookie(id, request) {
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  const parts = [`${COOKIE}=${encodeURIComponent(sign(PURPOSE, id))}`, 'Path=/api', `Max-Age=${MAX_AGE}`, 'HttpOnly', 'SameSite=Lax']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

// ---- callsigns: lowercase like the rest of the site, two words and a number

const FIRST = ['rust', 'neon', 'chem', 'brass', 'hex', 'smog', 'quiet', 'loud', 'slow', 'lucky', 'last', 'pale', 'iron', 'copper', 'static', 'velvet']
const SECOND = ['moth', 'drifter', 'rook', 'spark', 'comet', 'pilot', 'ghost', 'lantern', 'wren', 'piston', 'jelly', 'kite', 'orbit', 'vandal', 'signal', 'magpie']

const callsignFrom = (a, b, n) => `${FIRST[a % FIRST.length]}-${SECOND[b % SECOND.length]}-${String(n % 100).padStart(2, '0')}`

// The same suggestion every time for one pilot, so the name doesn't change between visits before it's saved.
export function callsignFor(pilotId) {
  const h = createHash('sha256').update(`callsign\n${pilotId}`).digest()
  return callsignFrom(h[0], h[1], h[2])
}

const CALLSIGN_RE = /^[a-z0-9](?:[a-z0-9 _-]{1,14})[a-z0-9]$/
// a short list; this is a portfolio toy, not a moderation system. The site owner's name is reserved.
const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'whore', 'slut', 'retard', 'kike', 'chink', 'paki', 'saubhagya']

// Normalises a requested callsign, or returns null if it isn't allowed. 3–16 chars: a–z, 0–9, space, _ and -.
export function cleanCallsign(input) {
  if (typeof input !== 'string') return null
  const s = input.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
  if (!CALLSIGN_RE.test(s)) return null
  const squashed = s.replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/[^a-z]/g, '')
  if (BLOCKED.some((w) => squashed.includes(w))) return null
  return s
}
