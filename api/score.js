import { assertSameOrigin, HttpError, json, readJson, route } from './_lib/http.js'
import { rateLimit } from './_lib/limit.js'
import { callsignFor, cleanCallsign, pilotFrom } from './_lib/pilot.js'
import { publicTag, readRun } from './_lib/sign.js'
import { getStore } from './_lib/store.js'
import { checkRun } from './_lib/validate.js'
import { pilotView } from './_lib/view.js'

// POST /api/score  { run, score, wave, kills, callsign? } → { pilot, isBest, rank }
// Spends a run token from /api/run. The token must belong to this browser's pilot, be unspent and
// under four hours old, and the numbers must be ones the game could actually produce.

export const POST = route(async (request) => {
  assertSameOrigin(request)
  rateLimit(request, 'score', { max: 20 })
  const body = await readJson(request)
  const run = readRun(body?.run)
  if (!run) throw new HttpError(400, 'bad-run')
  const id = pilotFrom(request)
  if (!id || id !== run.pilotId) throw new HttpError(403, 'not-your-run')
  const now = Date.now()
  const check = checkRun(body, run, now)
  if (!check.ok) throw new HttpError(422, check.reason)
  const store = await getStore()
  const { pilot, isBest } = await store.submit({
    pilotId: id,
    tag: publicTag(id),
    fallbackCallsign: cleanCallsign(body.callsign) ?? callsignFor(id),
    runId: run.runId,
    score: check.score,
    wave: check.wave,
    kills: check.kills,
    city: run.city,
    now,
  })
  const view = await pilotView(store, pilot)
  return json({ pilot: view, isBest, rank: view.rank })
})
