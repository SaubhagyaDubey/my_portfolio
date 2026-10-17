import { assertSameOrigin, json, readJson, route } from './_lib/http.js'
import { rateLimit } from './_lib/limit.js'
import { newPilotId, pilotCookie, pilotFrom } from './_lib/pilot.js'
import { issueRun } from './_lib/sign.js'

// POST /api/run  { city } → { run }: a signed token the game spends when it submits the run's score.
// Gives this browser a pilot cookie if it doesn't have one yet. Writes nothing to the database.

export const POST = route(async (request) => {
  assertSameOrigin(request)
  rateLimit(request, 'run', { max: 30 })
  const body = await readJson(request)
  const existing = pilotFrom(request)
  const id = existing ?? newPilotId()
  const run = issueRun(id, Date.now(), body?.city === 'top' ? 'top' : 'under')
  const headers = existing ? {} : { 'set-cookie': pilotCookie(id, request) }
  return json({ run }, { headers })
})
