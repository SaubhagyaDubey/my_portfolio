import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { JOURNEY } from '../src/data/journey.js'
import { WORLDS } from '../src/data/worlds.js'
import {
  BOOST,
  CHARGE,
  LEG,
  LEAVE,
  cardOf,
  createJourney,
  dockAt,
  dwellFor,
  forkShown,
  leave,
  next,
  progress,
  restPoint,
  restart,
  stepJourney,
  toFork,
} from '../src/lib/journey.js'

const N = JOURNEY.length
const DWELLS = JOURNEY.map(dwellFor)
const DT = 1 / 60

// step until the phase changes (or a limit), returning the seconds it took and the events seen
function run(j, until, limit = 30) {
  const events = []
  let t = 0
  while (!until(j) && t < limit) {
    const ev = stepJourney(j, DT, DWELLS)
    if (ev) events.push(ev)
    t += DT
  }
  return { t, events }
}

describe('the stops', () => {
  test('each one is real: its body points at a galaxy stop, and work facts match the flags', () => {
    for (const st of JOURNEY) {
      const src = WORLDS[st.body.world].stops.find((s) => s.id === st.body.stop)
      assert.ok(src, `${st.id} → ${st.body.world}/${st.body.stop}`)
      if (st.city === 'top') assert.equal(st.fact, src.fact)
    }
  })

  test('the first card is my name, and the ride stays around half a minute', () => {
    assert.equal(JOURNEY[0].title, 'Saubhagya Dubey')
    const total = DWELLS.reduce((a, b) => a + b, 0) + (N + 1) * LEG + CHARGE
    assert.ok(total > 28 && total < 42, `${total.toFixed(1)} s`)
  })

  test('reading time is between 6 and 9 s', () => {
    for (const d of DWELLS) assert.ok(d >= 6 && d <= 9)
  })
})

describe('take-off', () => {
  test('holding fills the ring and launches; letting go early drains it', () => {
    const j = createJourney(N)
    j.holding = true
    run(j, (s) => s.charge > 0.5)
    j.holding = false
    const was = j.charge
    stepJourney(j, 0.1, DWELLS)
    assert.ok(j.charge < was)
    assert.equal(j.phase, 'ready')
    j.holding = true
    const { t, events } = run(j, (s) => s.phase !== 'ready')
    assert.equal(j.phase, 'fly')
    assert.deepEqual(events, ['launch'])
    assert.ok(t <= CHARGE + 0.05)
  })

  test('a click takes off by itself', () => {
    const j = createJourney(N)
    next(j)
    run(j, (s) => s.phase !== 'ready', 2)
    assert.equal(j.phase, 'fly')
    assert.equal(j.i, 0)
  })
})

describe('the ride', () => {
  test('flies to every stop in order, shows its card, then reaches the fork', () => {
    const j = createJourney(N)
    next(j)
    const seen = []
    const { events } = run(j, (s) => {
      const c = cardOf(s)
      if (c !== null && seen.at(-1) !== c) seen.push(c)
      return s.phase === 'fork'
    }, 60)
    assert.deepEqual(seen, JOURNEY.map((_, i) => i))
    assert.equal(events.filter((e) => e === 'arrive').length, N)
    assert.equal(events.at(-1), 'fork')
    assert.equal(j.d, dockAt(N))
    assert.equal(progress(j), 1)
  })

  test('the card comes up while braking, not at the start of the leg', () => {
    const j = createJourney(N)
    next(j)
    run(j, (s) => s.phase === 'fly')
    stepJourney(j, DT, DWELLS)
    assert.equal(cardOf(j), null)
    run(j, (s) => s.phase === 'dwell')
    assert.equal(cardOf(j), 0)
  })

  test('progress only goes forward', () => {
    const j = createJourney(N)
    next(j)
    let last = 0
    run(j, (s) => {
      const p = progress(s)
      assert.ok(p >= last - 1e-9, `${p} < ${last}`)
      last = p
      return s.phase === 'fork'
    }, 60)
  })

  test('holding space gets there faster', () => {
    const plain = createJourney(N)
    next(plain)
    const a = run(plain, (s) => s.phase === 'fork', 60).t
    const held = createJourney(N)
    next(held)
    held.holding = true
    const b = run(held, (s) => s.phase === 'fork', 60).t
    assert.ok(b < a / (BOOST * 0.8), `${b.toFixed(1)} vs ${a.toFixed(1)}`)
  })

  test('next leaves a stop at once, and hurries a leg', () => {
    const j = createJourney(N)
    next(j)
    run(j, (s) => s.phase === 'dwell')
    next(j)
    assert.equal(j.phase, 'fly')
    assert.equal(j.i, 1)
    next(j)
    const { t } = run(j, (s) => s.phase === 'dwell')
    assert.ok(t < LEG * 0.5)
  })

  test('skipping lands at the fork; flying again starts over', () => {
    const j = createJourney(N)
    next(j)
    run(j, (s) => s.phase === 'dwell')
    toFork(j)
    assert.equal(j.phase, 'fork')
    assert.ok(forkShown(j))
    restart(j)
    assert.equal(j.phase, 'ready')
    assert.equal(j.d, 0)
    assert.equal(progress(j), 0)
  })

  test('reduced motion cuts between stops and never moves on by itself', () => {
    const j = createJourney(N, { reduced: true })
    next(j)
    stepJourney(j, DT, DWELLS)
    stepJourney(j, DT, DWELLS)
    assert.equal(j.phase, 'dwell')
    assert.equal(j.i, 0)
    run(j, () => false, 20)
    assert.equal(j.phase, 'dwell')
    assert.equal(j.i, 0)
    assert.equal(j.speed, 0)
  })
})

describe('the fork', () => {
  test('picking a way out leaves once, after LEAVE', () => {
    const j = createJourney(N, { fork: true })
    assert.equal(j.phase, 'fork')
    assert.equal(leave(j, 'top'), true)
    assert.equal(leave(j, 'under'), false)
    const { t, events } = run(j, () => false, LEAVE + 0.5)
    assert.deepEqual(events, ['left'])
    assert.ok(t >= LEAVE)
    assert.equal(j.leaveKey, 'top')
  })

  test('only from the fork, or the leg into it', () => {
    const j = createJourney(N)
    assert.equal(leave(j, 'play'), false)
    next(j)
    run(j, (s) => s.phase === 'fly' && s.i === N, 60)
    assert.equal(leave(j, 'play'), true)
  })
})

describe('the cockpit view', () => {
  const eye = [0, 0.47, -0.6]
  test('the middle of the screen is straight ahead, a little up', () => {
    const [x, y, z] = restPoint(dockAt(0), 0, 0, 100, 16 / 9, eye)
    assert.ok(Math.abs(x) < 1e-9)
    assert.ok(y > eye[1])
    assert.ok(z < -dockAt(0) - 90)
  })

  test('left is left and up is up', () => {
    const [x1, y1] = restPoint(0, -0.5, 0.5, 100, 16 / 9, eye)
    const [x2, y2] = restPoint(0, 0.5, -0.5, 100, 16 / 9, eye)
    assert.ok(x1 < 0 && x2 > 0)
    assert.ok(y1 > y2)
  })
})
