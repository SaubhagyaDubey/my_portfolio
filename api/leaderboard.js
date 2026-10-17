import { HttpError, json, route } from './_lib/http.js'
import { getStore } from './_lib/store.js'

// GET /api/leaderboard → { entries: [{ callsign, tag, best, wave, city, at }] }, the top 10 pilots by best run.
// Public and the same for everyone, so the CDN holds it briefly. Any query string is refused, so random
// parameters can't be used to skip the cache, and each warm instance also remembers the last answer briefly.

export const BOARD_SIZE = 10
const MEMO_MS = 10_000
let memo = null // { at, entries }

export const GET = route(async (request) => {
  if (new URL(request.url).search) throw new HttpError(400, 'no-params')
  const now = Date.now()
  if (!memo || now - memo.at > MEMO_MS) {
    const store = await getStore()
    memo = { at: now, entries: await store.top(BOARD_SIZE) }
  }
  return json({ entries: memo.entries }, { headers: { 'cache-control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=30' } })
})

// for tests
export function forgetBoard() {
  memo = null
}
