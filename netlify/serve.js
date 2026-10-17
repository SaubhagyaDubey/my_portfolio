import { methodNotAllowed } from '../api/_lib/http.js'

// Runs an api/<name>.js module (Web-standard GET/POST handlers, written for Vercel) as a Netlify function.
// Anything served from here is hosted, so config is required (see api/_lib/env.js) unless under `netlify dev`.
if (!process.env.NETLIFY_DEV) process.env.DEEP_FIELD_HOSTED = '1'

export function serve(mod) {
  return (request) => {
    const handler = mod[request.method]
    return typeof handler === 'function' ? handler(request) : methodNotAllowed()
  }
}
