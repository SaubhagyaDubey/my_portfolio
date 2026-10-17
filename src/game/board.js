import { create } from 'zustand'

// The leaderboard and this browser's pilot, from the /api functions. Every call fails soft: the game
// never waits on the network, and without it the board just says it's offline.

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error ?? `http-${res.status}`)
    err.code = data.error ?? `http-${res.status}`
    err.status = res.status
    throw err
  }
  return data
}

export const BOARD_SIZE = 10

export const useBoard = create(() => ({
  status: 'idle', // idle | loading | ready | offline
  entries: [],
  pilot: null, // { callsign, tag, best, wave, city, runs, rank } once this browser has a score or a callsign
  suggestion: null, // a callsign to fly under until one is saved
  submit: null, // last run: { state: 'saving' | 'saved' | 'skipped' | 'failed', isBest, rank, reason }
}))

const set = (patch) => useBoard.setState(patch)

export function callsignOf(state = useBoard.getState()) {
  return state.pilot?.callsign ?? state.suggestion ?? null
}

export async function loadBoard() {
  if (useBoard.getState().status === 'idle') set({ status: 'loading' })
  try {
    const [{ entries }, me] = await Promise.all([call(`/api/leaderboard?limit=${BOARD_SIZE}`), call('/api/pilot')])
    set({ status: 'ready', entries, pilot: me.pilot, suggestion: me.pilot ? null : me.suggestion })
  } catch {
    set({ status: 'offline' })
  }
}

// ---- runs: a token is fetched when a run starts and spent when it ends
let pendingRun = null

export function beginRun(city) {
  set({ submit: null })
  pendingRun = call('/api/run', { method: 'POST', body: { city } })
    .then((r) => r.run)
    .catch(() => null)
}

export function abandonRun() {
  pendingRun = null
}

export async function finishRun({ score, wave, kills }) {
  const token = await pendingRun
  pendingRun = null
  if (!token) {
    set({ submit: { state: 'failed', reason: 'offline' } })
    return
  }
  if (score <= 0) {
    set({ submit: { state: 'skipped' } })
    return
  }
  set({ submit: { state: 'saving' } })
  try {
    const res = await call('/api/score', { method: 'POST', body: { run: token, score, wave, kills, callsign: callsignOf() } })
    const st = useBoard.getState()
    set({ pilot: res.pilot, suggestion: null, entries: mergeEntry(st.entries, res.pilot), submit: { state: 'saved', isBest: res.isBest, rank: res.rank } })
    // the CDN may hold the public board for a few seconds; refresh after that
    setTimeout(() => refreshEntries(), 12_000)
  } catch (err) {
    set({ submit: { state: 'failed', reason: err.code ?? 'offline' } })
  }
}

async function refreshEntries() {
  try {
    const { entries } = await call(`/api/leaderboard?limit=${BOARD_SIZE}`)
    const { pilot } = useBoard.getState()
    set({ entries: mergeEntry(entries, pilot), status: 'ready' })
  } catch {
    // keep what we have
  }
}

// Put this pilot's latest best into the visible board right away instead of waiting for the cache.
function mergeEntry(entries, pilot) {
  if (!pilot || !pilot.best) return entries
  const mine = { callsign: pilot.callsign, tag: pilot.tag, best: pilot.best, wave: pilot.wave, city: pilot.city }
  const rest = entries.filter((e) => e.tag !== pilot.tag)
  const merged = [...rest, mine].sort((a, b) => b.best - a.best)
  return merged.slice(0, BOARD_SIZE)
}

export async function saveCallsign(callsign) {
  const res = await call('/api/pilot', { method: 'POST', body: { callsign } })
  const st = useBoard.getState()
  const entries = st.entries.map((e) => (res.pilot && e.tag === res.pilot.tag ? { ...e, callsign: res.pilot.callsign } : e))
  set({ pilot: res.pilot, suggestion: null, entries })
  return res.pilot
}
