// What the API says about a pilot. Never includes the private pilot id; `tag` is the public handle.
export async function pilotView(store, p) {
  if (!p) return null
  return { callsign: p.callsign, tag: p.tag, best: p.best, wave: p.bestWave, city: p.bestCity, runs: p.runs, rank: await store.rankOf(p.best) }
}
