import { ConfigError } from './env.js'
import { StoreError } from './store.js'

// Small helpers for the Web-standard (Request → Response) handlers Vercel runs from /api.

export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

const fail = (status, error) => json({ error }, { status })

// Parses a small JSON body. Requiring application/json also means a cross-site form can't post here
// without a CORS preflight, which this API never grants.
export async function readJson(request, maxBytes = 2048) {
  const type = request.headers.get('content-type') ?? ''
  if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'json-only')
  const text = await request.text()
  if (text.length > maxBytes) throw new HttpError(413, 'too-large')
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'bad-json')
  }
}

// Writes only come from this site's own pages: browsers send Origin on POST, and it must match.
export function assertSameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return // same-origin fetches from older browsers, curl, tests
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
  let originHost
  try {
    originHost = new URL(origin).host
  } catch {
    throw new HttpError(403, 'bad-origin')
  }
  if (originHost !== host) throw new HttpError(403, 'bad-origin')
}

export class HttpError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}

const STORE_STATUS = { replay: 409, 'too-soon': 429 }

// Wraps a handler: maps expected errors to statuses, logs the rest, never leaks internals.
export function route(handler) {
  return async (request) => {
    try {
      return await handler(request)
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.code)
      if (err instanceof StoreError) return fail(STORE_STATUS[err.code] ?? 400, err.code)
      if (err instanceof ConfigError) {
        console.error(`[api] not configured: ${err.message}`)
        return fail(503, 'not-configured')
      }
      console.error('[api] unexpected error', err)
      return fail(500, 'server-error')
    }
  }
}

export function methodNotAllowed() {
  return fail(405, 'method-not-allowed')
}
