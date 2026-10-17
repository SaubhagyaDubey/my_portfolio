import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import { GET as board, forgetBoard } from '../api/leaderboard.js'
import { GET as getPilot, POST as postPilot } from '../api/pilot.js'
import { POST as postRun } from '../api/run.js'
import { POST as postScore } from '../api/score.js'
import { resetLimits } from '../api/_lib/limit.js'
import { cleanCallsign } from '../api/_lib/pilot.js'
import { issueRun, readRun, sign, verify } from '../api/_lib/sign.js'
import { useStore } from '../api/_lib/store.js'
import { checkRun, maxKills, maxScore, minSeconds } from '../api/_lib/validate.js'
import { BOSS_EVERY, multiplier, SCORES } from '../src/game/rules.js'
import { buildWave } from '../src/game/waveplan.js'

const ORIGIN = 'http://localhost:5173'

function req(path, { method = 'GET', body, cookie, origin = ORIGIN, type = 'application/json' } = {}) {
  const headers = { host: 'localhost:5173' }
  if (cookie) headers.cookie = cookie
  if (origin && method !== 'GET') headers.origin = origin
  if (body !== undefined) headers['content-type'] = type
  return new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
}

const cookieOf = (res) => res.headers.get('set-cookie')?.split(';')[0] ?? null

async function newRun(cookie) {
  const res = await postRun(req('/api/run', { method: 'POST', body: { city: 'top' }, cookie }))
  assert.equal(res.status, 200)
  return { cookie: cookie ?? cookieOf(res), run: (await res.json()).run }
}

beforeEach(() => {
  delete globalThis.__deepFieldStore
  useStore(null)
  resetLimits()
  forgetBoard()
})

describe('signing', () => {
  test('round-trips and rejects tampering', () => {
    const v = sign('pilot', 'abc')
    assert.equal(verify('pilot', v), 'abc')
    assert.equal(verify('pilot', v.replace('abc', 'abd')), null)
    assert.equal(verify('pilot', v.slice(0, -2) + 'xx'), null)
    assert.equal(verify('pilot', 'no-dot'), null)
  })
  test('a cookie can not be used as a run token', () => {
    const cookieValue = sign('pilot', 'abc')
    assert.equal(verify('run', cookieValue), null)
  })
  test('run tokens carry pilot, run id, time and city', () => {
    const r = readRun(issueRun('pilot-id', 1234, 'top'))
    assert.deepEqual({ ...r, runId: typeof r.runId }, { pilotId: 'pilot-id', runId: 'string', startedAt: 1234, city: 'top' })
  })
})

describe('callsigns', () => {
  test('normalises allowed names', () => {
    assert.equal(cleanCallsign('  Neon  Moth '), 'neon moth')
    assert.equal(cleanCallsign('rust-rook_07'), 'rust-rook_07')
  })
  test('rejects bad shapes and blocked words', () => {
    for (const bad of ['ab', 'x'.repeat(17), '-dash', 'emoji🚀', '<script>', 'f4ggot', 'n1gg4', 42, null]) assert.equal(cleanCallsign(bad), null, String(bad))
  })
})

describe('run checks', () => {
  const run = { startedAt: 0 }
  const at = (seconds) => seconds * 1000

  test('wave 1 holds exactly what the wave plan spawns', () => {
    const events = buildWave(1)
    assert.equal(maxKills(1, 30), events.length)
    // a perfect unbroken streak through every wave-1 creature, best ones last
    const values = events.map((e) => SCORES[e.kind]).sort((x, y) => x - y)
    const perfect = values.reduce((sum, v, i) => sum + v * multiplier(i + 1), 0)
    assert.equal(maxScore(events.length, 1, 30), perfect)
  })

  test('accepts runs at the very edge of what the game can do', () => {
    for (const wave of [1, 2, 3, 4, 5, 6, 9, 10, 11, 20, 37]) {
      const seconds = minSeconds(wave) + 0.001
      const kills = maxKills(wave, seconds)
      const score = maxScore(kills, wave, seconds)
      assert.equal(checkRun({ score, wave, kills }, run, at(seconds)).ok, true, `wave ${wave}`)
      assert.equal(checkRun({ score: SCORES.jelly, wave, kills: 1 }, run, at(seconds + 600)).ok, true, `slow wave ${wave}`)
    }
  })

  test('a boss wave allows the boss and its darts', () => {
    const seconds = minSeconds(BOSS_EVERY) + 60
    assert.equal(checkRun({ score: SCORES.boss * 8, wave: BOSS_EVERY, kills: 0 }, run, at(seconds)).ok, true)
    assert.ok(maxKills(BOSS_EVERY, seconds + 75) > maxKills(BOSS_EVERY, seconds)) // called darts add up over time
  })

  test('rejects runs the game cannot produce', () => {
    assert.equal(checkRun({ score: 120, wave: 1, kills: 1 }, run, at(5)).reason, 'impossible-score') // not a multiple of 50
    assert.equal(checkRun({ score: 512000, wave: 1, kills: 160 }, run, at(1)).reason, 'too-many-kills')
    assert.equal(checkRun({ score: maxScore(30, 1, 30) + 50, wave: 1, kills: 30 }, run, at(30)).reason, 'impossible-score')
    assert.equal(checkRun({ score: 50000000, wave: 100, kills: 16600 }, run, at(600)).reason, 'too-fast')
    assert.equal(checkRun({ score: 100, wave: 10, kills: 1 }, run, at(5)).reason, 'too-fast')
    assert.equal(checkRun({ score: 100, wave: 1, kills: 999 }, run, at(5)).reason, 'too-many-kills')
    assert.equal(checkRun({ score: 100, wave: 1, kills: 1 }, run, at(5 * 60 * 60)).reason, 'run-expired')
    assert.equal(checkRun({ score: '100', wave: 1, kills: 1 }, run, at(5)).reason, 'bad-numbers')
    assert.equal(checkRun({ score: -50, wave: 1, kills: 1 }, run, at(5)).reason, 'out-of-range')
  })
})

describe('api', () => {
  test('a run gives the browser a pilot cookie, HttpOnly and scoped to /api', async () => {
    const res = await postRun(req('/api/run', { method: 'POST', body: {} }))
    const header = res.headers.get('set-cookie')
    assert.match(header, /^df_pilot=/)
    assert.match(header, /HttpOnly/)
    assert.match(header, /SameSite=Lax/)
    assert.match(header, /Path=\/api/)
  })

  test('submitting a score puts the pilot on the board, once', async () => {
    const { cookie, run } = await newRun()
    const res = await postScore(req('/api/score', { method: 'POST', cookie, body: { run, score: 300, wave: 1, kills: 2, callsign: 'Neon Moth' } }))
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.isBest, true)
    assert.equal(data.rank, 1)
    assert.equal(data.pilot.callsign, 'neon moth')
    assert.equal(data.pilot.best, 300)
    assert.equal('id' in data.pilot, false)

    const again = await postScore(req('/api/score', { method: 'POST', cookie, body: { run, score: 300, wave: 1, kills: 2 } }))
    assert.equal(again.status, 409)

    const top = await (await board(req('/api/leaderboard'))).json()
    assert.equal(top.entries.length, 1)
    assert.equal(top.entries[0].callsign, 'neon moth')
    assert.equal(top.entries[0].tag, data.pilot.tag)

    const me = await (await getPilot(req('/api/pilot', { cookie }))).json()
    assert.equal(me.pilot.best, 300)
    assert.equal(me.pilot.rank, 1)
  })

  test('a second submission inside the cooldown is refused', async () => {
    const first = await newRun()
    const second = await newRun(first.cookie)
    assert.equal((await postScore(req('/api/score', { method: 'POST', cookie: first.cookie, body: { run: first.run, score: 100, wave: 1, kills: 1 } }))).status, 200)
    assert.equal((await postScore(req('/api/score', { method: 'POST', cookie: first.cookie, body: { run: second.run, score: 100, wave: 1, kills: 1 } }))).status, 429)
  })

  test("someone else's run token is refused", async () => {
    const mine = await newRun()
    const theirs = await newRun()
    const res = await postScore(req('/api/score', { method: 'POST', cookie: mine.cookie, body: { run: theirs.run, score: 100, wave: 1, kills: 1 } }))
    assert.equal(res.status, 403)
  })

  test('no cookie, forged token, bad numbers', async () => {
    const { run } = await newRun()
    assert.equal((await postScore(req('/api/score', { method: 'POST', body: { run, score: 100, wave: 1, kills: 1 } }))).status, 403)
    const { cookie } = await newRun()
    assert.equal((await postScore(req('/api/score', { method: 'POST', cookie, body: { run: run + 'x', score: 100, wave: 1, kills: 1 } }))).status, 400)
    const own = await newRun()
    assert.equal((await postScore(req('/api/score', { method: 'POST', cookie: own.cookie, body: { run: own.run, score: 999950, wave: 1, kills: 1 } }))).status, 422)
  })

  test('writes need JSON from this origin', async () => {
    assert.equal((await postRun(req('/api/run', { method: 'POST', body: {}, origin: 'https://evil.example' }))).status, 403)
    assert.equal((await postRun(req('/api/run', { method: 'POST', body: 'city=top', type: 'application/x-www-form-urlencoded' }))).status, 415)
    assert.equal((await postPilot(req('/api/pilot', { method: 'POST', body: '{nope' }))).status, 400)
  })

  test('renaming before the first score writes nothing; the name rides along with the first score', async () => {
    const res = await postPilot(req('/api/pilot', { method: 'POST', body: { callsign: 'Brass Kite' } }))
    assert.equal(res.status, 200)
    const cookie = cookieOf(res)
    assert.ok(cookie)
    assert.deepEqual(await res.json(), { pilot: null, callsign: 'brass kite' })
    assert.equal(globalThis.__deepFieldStore?.pilots.size ?? 0, 0)
    assert.equal((await postPilot(req('/api/pilot', { method: 'POST', cookie, body: { callsign: 'x' } }))).status, 400)

    const { run } = await newRun(cookie)
    const scored = await (await postScore(req('/api/score', { method: 'POST', cookie, body: { run, score: 100, wave: 1, kills: 1, callsign: 'brass kite' } }))).json()
    assert.equal(scored.pilot.callsign, 'brass kite')
    const renamed = await postPilot(req('/api/pilot', { method: 'POST', cookie, body: { callsign: 'brass kite two' } }))
    assert.equal(renamed.headers.get('set-cookie'), null)
    assert.equal((await renamed.json()).pilot.callsign, 'brass kite two')
  })

  test('the board refuses query strings, so the cache can not be skipped', async () => {
    assert.equal((await board(req('/api/leaderboard?limit=25&x=1'))).status, 400)
    assert.equal((await board(req('/api/leaderboard'))).status, 200)
  })

  test('writes are rate-limited per IP', async () => {
    let status = 200
    for (let i = 0; i < 31 && status === 200; i++) status = (await postRun(req('/api/run', { method: 'POST', body: {} }))).status
    assert.equal(status, 429)
  })

  test("the site owner's name is reserved", () => {
    assert.equal(cleanCallsign('Saubhagya'), null)
  })

  test('a fresh browser gets a cookie and a stable suggestion, not a pilot', async () => {
    const res = await getPilot(req('/api/pilot'))
    const cookie = cookieOf(res)
    assert.ok(cookie)
    const data = await res.json()
    assert.equal(data.pilot, null)
    assert.ok(cleanCallsign(data.suggestion))
    const again = await (await getPilot(req('/api/pilot', { cookie }))).json()
    assert.equal(again.suggestion, data.suggestion)
  })

  test('production without a secret refuses instead of signing with the dev key', async () => {
    const saved = { NODE_ENV: process.env.NODE_ENV, COOKIE_SECRET: process.env.COOKIE_SECRET }
    process.env.NODE_ENV = 'production'
    delete process.env.COOKIE_SECRET
    try {
      const res = await postRun(req('/api/run', { method: 'POST', body: {} }))
      assert.equal(res.status, 503)
    } finally {
      if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = saved.NODE_ENV
      if (saved.COOKIE_SECRET !== undefined) process.env.COOKIE_SECRET = saved.COOKIE_SECRET
    }
  })
})
