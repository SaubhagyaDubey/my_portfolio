import { firebaseCredentials, isProduction, ConfigError } from './env.js'
import { RUN_MAX_AGE } from './validate.js'

// Where pilots and scores live. Firestore when credentials are configured; otherwise (outside production)
// an in-memory store that survives for as long as the dev server does.
//
// Firestore layout (all access goes through these functions; security rules deny every client):
//   pilots/{pilotId}  { callsign, tag, best, bestWave, bestCity, bestAt, runs, lastSubmitAt, createdAt }
//   runs/{runId}      { pilotId, score, wave, kills, city, at, expireAt }   — one per spent run token, so tokens can't be replayed
//
// Errors with `code` are expected outcomes the API maps to HTTP statuses.

export const SUBMIT_COOLDOWN = 4000 // ms between score submissions from one pilot

export class StoreError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

let cached = null

export async function getStore() {
  if (cached) return cached
  const creds = firebaseCredentials()
  if (creds) cached = await firestoreStore(creds)
  else if (isProduction()) throw new ConfigError('Firebase credentials are not configured')
  else cached = memoryStore()
  return cached
}

// for tests
export function useStore(store) {
  cached = store
}

const publicEntry = (p) => ({ callsign: p.callsign, tag: p.tag, best: p.best, wave: p.bestWave, city: p.bestCity, at: p.bestAt })

// ------------------------------------------------------------------ Firestore
async function firestoreStore({ projectId, clientEmail, privateKey }) {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const app = getApps().find((a) => a.name === 'deep-field') ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, 'deep-field')
  const db = getFirestore(app)
  const pilots = db.collection('pilots')
  const runs = db.collection('runs')

  return {
    kind: 'firestore',

    async getPilot(id) {
      const snap = await pilots.doc(id).get()
      return snap.exists ? snap.data() : null
    },

    // renames an existing pilot; returns null when there is none yet (nothing is written)
    async rename(id, callsign) {
      const ref = pilots.doc(id)
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) return null
        const next = { ...snap.data(), callsign }
        tx.set(ref, next)
        return next
      })
    },

    async submit({ pilotId, tag, fallbackCallsign, runId, score, wave, kills, city, now }) {
      const ref = pilots.doc(pilotId)
      const runRef = runs.doc(runId)
      return db.runTransaction(async (tx) => {
        const [snap, runSnap] = await Promise.all([tx.get(ref), tx.get(runRef)])
        if (runSnap.exists) throw new StoreError('replay')
        const prev = snap.exists ? snap.data() : newPilot({ callsign: fallbackCallsign, tag, now })
        if (prev.lastSubmitAt && now - prev.lastSubmitAt < SUBMIT_COOLDOWN) throw new StoreError('too-soon')
        const next = applyRun(prev, { score, wave, city, now })
        tx.set(ref, next)
        // expireAt lets a Firestore TTL policy delete spent runs once their token could no longer be replayed
        tx.create(runRef, { pilotId, score, wave, kills, city, at: now, expireAt: new Date(now + RUN_MAX_AGE + 60_000) })
        return { pilot: next, isBest: score > (prev.best ?? 0) }
      })
    },

    async rankOf(best) {
      if (!best) return null
      const agg = await pilots.where('best', '>', best).count().get()
      return agg.data().count + 1
    },

    async top(limit) {
      const snap = await pilots.where('best', '>', 0).orderBy('best', 'desc').limit(limit).get()
      return snap.docs.map((d) => publicEntry(d.data()))
    },
  }
}

// ------------------------------------------------------------------ in-memory (dev)
function memoryStore() {
  // globalThis so the data survives Vite reloading the API modules
  const mem = (globalThis.__deepFieldStore ??= { pilots: new Map(), runs: new Set() })
  return {
    kind: 'memory',
    async getPilot(id) {
      return mem.pilots.get(id) ?? null
    },
    async rename(id, callsign) {
      const prev = mem.pilots.get(id)
      if (!prev) return null
      const next = { ...prev, callsign }
      mem.pilots.set(id, next)
      return next
    },
    async submit({ pilotId, tag, fallbackCallsign, runId, score, wave, city, now }) {
      if (mem.runs.has(runId)) throw new StoreError('replay')
      const prev = mem.pilots.get(pilotId) ?? newPilot({ callsign: fallbackCallsign, tag, now })
      if (prev.lastSubmitAt && now - prev.lastSubmitAt < SUBMIT_COOLDOWN) throw new StoreError('too-soon')
      const next = applyRun(prev, { score, wave, city, now })
      mem.runs.add(runId)
      mem.pilots.set(pilotId, next)
      return { pilot: next, isBest: score > (prev.best ?? 0) }
    },
    async rankOf(best) {
      if (!best) return null
      let above = 0
      for (const p of mem.pilots.values()) if (p.best > best) above++
      return above + 1
    },
    async top(limit) {
      return [...mem.pilots.values()]
        .filter((p) => p.best > 0)
        .sort((a, b) => b.best - a.best || a.bestAt - b.bestAt)
        .slice(0, limit)
        .map(publicEntry)
    },
  }
}

// ------------------------------------------------------------------ shared
function newPilot({ callsign, tag, now }) {
  return { callsign, tag, best: 0, bestWave: 0, bestCity: null, bestAt: null, runs: 0, lastSubmitAt: null, createdAt: now }
}

function applyRun(prev, { score, wave, city, now }) {
  const next = { ...prev, runs: (prev.runs ?? 0) + 1, lastSubmitAt: now }
  if (score > (prev.best ?? 0)) Object.assign(next, { best: score, bestWave: wave, bestCity: city, bestAt: now })
  return next
}
