import { assertSameOrigin, HttpError, json, readJson, route } from './_lib/http.js'
import { callsignFor, cleanCallsign, newPilotId, pilotCookie, pilotFrom } from './_lib/pilot.js'
import { publicTag } from './_lib/sign.js'
import { getStore } from './_lib/store.js'
import { pilotView } from './_lib/view.js'

// GET  /api/pilot   → { pilot } for this browser, or { pilot: null, suggestion } before its first score.
//                     Hands out the pilot cookie on first visit (no database write until a score or a rename).
// POST /api/pilot   { callsign } → sets this browser's callsign (creating the pilot if needed)

export const GET = route(async (request) => {
  const existing = pilotFrom(request)
  const id = existing ?? newPilotId()
  const headers = existing ? {} : { 'set-cookie': pilotCookie(id, request) }
  const store = await getStore()
  const pilot = existing ? await pilotView(store, await store.getPilot(id)) : null
  return json(pilot ? { pilot } : { pilot: null, suggestion: callsignFor(id) }, { headers })
})

export const POST = route(async (request) => {
  assertSameOrigin(request)
  const body = await readJson(request)
  const callsign = cleanCallsign(body?.callsign)
  if (!callsign) throw new HttpError(400, 'bad-callsign')
  const existing = pilotFrom(request)
  const id = existing ?? newPilotId()
  const store = await getStore()
  const p = await store.setCallsign(id, { callsign, tag: publicTag(id), now: Date.now() })
  const headers = existing ? {} : { 'set-cookie': pilotCookie(id, request) }
  return json({ pilot: await pilotView(store, p) }, { headers })
})
