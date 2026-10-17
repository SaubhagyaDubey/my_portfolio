import { HttpError } from './http.js'

// A per-IP fixed-window rate limit, kept in the function instance's memory. Vercel reuses warm instances,
// so this blunts a scripted loop cheaply; it is not global (each instance counts on its own). For a hard,
// global limit add a Vercel Firewall rate-limit rule on /api/* (see README).

const windows = (globalThis.__deepFieldLimits ??= new Map())
const MAX_KEYS = 10_000

export function clientIp(request) {
  // Vercel sets x-real-ip and overwrites x-forwarded-for, so neither can be spoofed there
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  const fwd = request.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : 'local'
}

export function rateLimit(request, bucket, { max, windowMs = 60_000 }) {
  const now = Date.now()
  const key = `${bucket}:${clientIp(request)}`
  let w = windows.get(key)
  if (!w || now - w.start >= windowMs) {
    if (windows.size >= MAX_KEYS) prune(now, windowMs)
    w = { start: now, count: 0 }
    windows.set(key, w)
  }
  w.count += 1
  if (w.count > max) throw new HttpError(429, 'slow-down')
}

function prune(now, windowMs) {
  for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k)
  // still full: drop the oldest half rather than grow without bound
  if (windows.size >= MAX_KEYS) [...windows.keys()].slice(0, MAX_KEYS / 2).forEach((k) => windows.delete(k))
}

// for tests
export function resetLimits() {
  windows.clear()
}
