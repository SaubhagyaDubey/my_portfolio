import { create } from 'zustand'
import { saveBest, useGame } from './state.js'

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
const PENDING_KEY = 'deepfield.impact.callsign' // a callsign picked before the first score, until it's sent

export const useBoard = create(() => ({
  status: 'idle', // idle | loading | ready | offline
  entries: [],
  pilot: null, // { callsign, tag, best, wave, city, runs, rank } once this browser has a score on the board
  suggestion: null, // the callsign to fly under until the first score saves one
  submit: null, // last run: { state: 'saving' | 'saved' | 'skipped' | 'failed', isBest, rank, reason }
}))

const set = (patch) => useBoard.setState(patch)

export function callsignOf(state = useBoard.getState()) {
  return state.pilot?.callsign ?? state.suggestion ?? null
}

function readPending() {
  try {
    return localStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}

function writePending(value) {
  try {
    if (value) localStorage.setItem(PENDING_KEY, value)
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // storage may be unavailable; the name just won't survive a reload
  }
}

// The device keeps its own best too (it works offline). Never let it read lower than the board's.
function syncBest(pilot) {
  if (!pilot?.best) return
  const st = useGame.getState()
  if (pilot.best > st.best) {
    st.set({ best: pilot.best })
    saveBest(pilot.best)
  }
}

// The first request from a new browser is what gives it the pilot cookie. Anything that depends on the
// cookie (a run token, a rename) waits for that request, so two cookie-less calls can't mint two pilots.
let pilotReady = Promise.resolve()

function chained(fn) {
  const p = pilotReady.then(fn)
  pilotReady = p.catch(() => {})
  return p
}

export async function loadBoard() {
  if (useBoard.getState().status !== 'ready') set({ status: 'loading' })
  const me = chained(() => call('/api/pilot'))
  try {
    const [{ entries }, mine] = await Promise.all([call('/api/leaderboard'), me])
    const pending = mine.pilot ? null : readPending()
    if (mine.pilot) writePending(null)
    set({ status: 'ready', entries: mergeEntry(entries, mine.pilot), pilot: mine.pilot, suggestion: mine.pilot ? null : (pending ?? mine.suggestion) })
    syncBest(mine.pilot)
  } catch {
    set({ status: 'offline' })
  }
}

// ---- runs: a token is fetched when a run starts and spent when it ends
let pendingRun = null
let runSeq = 0

export function beginRun(city) {
  runSeq += 1
  set({ submit: null })
  pendingRun = chained(() => call('/api/run', { method: 'POST', body: { city } }))
    .then((r) => r.run)
    .catch(() => null)
}

export function abandonRun() {
  runSeq += 1
  pendingRun = null
}

export async function finishRun({ score, wave, kills }) {
  const seq = runSeq
  const p = pendingRun
  pendingRun = null // taken now, so a run started while this one waits keeps its own token
  const note = (submit) => {
    if (seq === runSeq) set({ submit })
  }
  const token = await p
  if (!token) return note({ state: 'failed', reason: 'offline' })
  if (score <= 0) return note({ state: 'skipped' })
  note({ state: 'saving' })
  try {
    const res = await call('/api/score', { method: 'POST', body: { run: token, score, wave, kills, callsign: callsignOf() } })
    writePending(null)
    const st = useBoard.getState()
    set({ status: 'ready', pilot: res.pilot, suggestion: null, entries: mergeEntry(st.entries, res.pilot) })
    syncBest(res.pilot)
    note({ state: 'saved', isBest: res.isBest, rank: res.rank })
    // the CDN may hold the public board for a few seconds; refresh after that
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(refreshEntries, 12_000)
  } catch (err) {
    note({ state: 'failed', reason: err.code ?? 'offline' })
  }
}

let refreshTimer = null

export function stopRefresh() {
  clearTimeout(refreshTimer)
}

async function refreshEntries() {
  try {
    const { entries } = await call('/api/leaderboard')
    set({ entries: mergeEntry(entries, useBoard.getState().pilot), status: 'ready' })
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

// Renames this browser's pilot. Before the first score there's no pilot yet: the cleaned name is kept on
// this device and sent with the first score.
export async function saveCallsign(callsign) {
  const res = await chained(() => call('/api/pilot', { method: 'POST', body: { callsign } }))
  if (!res.pilot) {
    writePending(res.callsign)
    set({ suggestion: res.callsign, status: 'ready' })
    return res.callsign
  }
  const st = useBoard.getState()
  const entries = st.entries.map((e) => (e.tag === res.pilot.tag ? { ...e, callsign: res.pilot.callsign } : e))
  set({ pilot: res.pilot, suggestion: null, entries, status: 'ready' })
  return res.pilot.callsign
}

// Competition ranking: tied scores share a number, matching the rank the server reports.
export function rankIn(entries, best) {
  return entries.findIndex((e) => e.best === best) + 1
}
