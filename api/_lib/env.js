// Server configuration, read from the environment (Vercel project settings, or .env.local in dev).
//
//   COOKIE_SECRET              long random string; signs the pilot cookie and run tokens (required in production)
//   FIREBASE_SERVICE_ACCOUNT   the service-account JSON for the Firebase project, raw or base64
//   — or —
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//
// With no Firebase credentials outside production, the API falls back to an in-memory store so the game
// and its leaderboard work locally without any setup. In production, missing config is an error.

const DEV_SECRET = 'deep-field-dev-only-secret-do-not-use-in-production'

// Fails closed: anything that looks like production must be configured. `vite preview` also sets
// NODE_ENV=production, so the local dev plugin opts out with DEEP_FIELD_LOCAL=1.
// On Netlify, netlify/serve.js sets DEEP_FIELD_HOSTED for every deployed function.
export function isProduction() {
  if (process.env.VERCEL_ENV === 'production') return true
  if (process.env.DEEP_FIELD_HOSTED === '1') return true
  return process.env.NODE_ENV === 'production' && process.env.DEEP_FIELD_LOCAL !== '1'
}

export function cookieSecret() {
  const s = process.env.COOKIE_SECRET
  if (s && s.length >= 32) return s
  if (isProduction()) throw new ConfigError('COOKIE_SECRET is missing or shorter than 32 characters')
  return DEV_SECRET
}

export function firebaseCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (raw) {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    let json
    try {
      json = JSON.parse(text)
    } catch {
      throw new ConfigError('FIREBASE_SERVICE_ACCOUNT is not valid JSON (raw or base64)')
    }
    return { projectId: json.project_id, clientEmail: json.client_email, privateKey: json.private_key }
  }
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: key } = process.env
  if (projectId && clientEmail && key) return { projectId, clientEmail, privateKey: key.replace(/\\n/g, '\n') }
  return null
}

export class ConfigError extends Error {}
