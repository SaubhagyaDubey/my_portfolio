import { json, route } from './_lib/http.js'
import { getStore } from './_lib/store.js'

// GET /api/leaderboard?limit=10 → { entries: [{ callsign, tag, best, wave, city, at }] }
// One row per pilot (their best run). Public and the same for everyone, so the CDN can hold it briefly.

export const GET = route(async (request) => {
  const n = Number(new URL(request.url).searchParams.get('limit'))
  const limit = Number.isInteger(n) && n > 0 ? Math.min(n, 25) : 10
  const store = await getStore()
  const entries = await store.top(limit)
  return json({ entries }, { headers: { 'cache-control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=30' } })
})
