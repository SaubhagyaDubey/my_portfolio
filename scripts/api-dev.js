import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

// Serves the Vercel functions in /api from the Vite dev (and preview) server, so `npm run dev` has a
// working leaderboard without the Vercel CLI. Each /api/<name> maps to api/<name>.js and its exported
// GET/POST handler, called with a Web Request exactly as Vercel would.

const NAME_RE = /^[a-z][a-z0-9-]*$/
const API_DIR = fileURLToPath(new URL('../api/', import.meta.url))
const MAX_BODY = 16 * 1024

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function middleware(load) {
  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (!url.pathname.startsWith('/api/')) return next()
    const name = url.pathname.slice(5).replace(/\/$/, '')
    if (!NAME_RE.test(name) || !existsSync(`${API_DIR}${name}.js`)) return sendJson(res, 404, { error: 'not-found' })
    let mod
    try {
      mod = await load(`/api/${name}.js`)
    } catch (err) {
      console.error('[api-dev] failed to load', name, err)
      return sendJson(res, 500, { error: 'server-error' })
    }
    const handler = mod[req.method ?? 'GET']
    if (typeof handler !== 'function') return sendJson(res, 405, { error: 'method-not-allowed' })
    try {
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined) continue
        if (Array.isArray(v)) for (const x of v) headers.append(k, x)
        else headers.set(k, v)
      }
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
      const request = new Request(url, { method: req.method, headers, body: hasBody ? await readBody(req) : undefined })
      const response = await handler(request)
      res.statusCode = response.status
      response.headers.forEach((v, k) => {
        if (k !== 'set-cookie') res.setHeader(k, v)
      })
      const cookies = response.headers.getSetCookie()
      if (cookies.length) res.setHeader('set-cookie', cookies)
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (err) {
      console.error('[api-dev]', err)
      if (!res.headersSent) sendJson(res, 500, { error: 'server-error' })
      else res.end()
    }
  }
}

export function apiDev() {
  let ssrLoad = null
  return {
    name: 'deep-field-api-dev',
    config(_, { mode }) {
      // hand non-VITE_ variables from .env files to the API (Vite only exposes VITE_* to the client)
      const env = loadEnv(mode, process.cwd(), '')
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
    },
    configureServer(server) {
      ssrLoad = (id) => server.ssrLoadModule(id)
      server.middlewares.use(middleware((id) => ssrLoad(id)))
    },
    configurePreviewServer(server) {
      // preview sets NODE_ENV=production; this is still a local server, so allow the dev fallbacks
      process.env.DEEP_FIELD_LOCAL ??= '1'
      // preview has no module graph; import the files directly
      server.middlewares.use(middleware((id) => import(new URL(`..${id}`, import.meta.url).href)))
    },
  }
}
