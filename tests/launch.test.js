import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { WORLDS, previewLines } from '../src/data/worlds.js'
import { approachPoint, APPROACH_GAP } from '../src/lib/arrival.js'
import { gazeFor } from '../src/lib/gaze.js'
import { INTRO, INTRO_DOM, beat } from '../src/lib/intro.js'
import { ARM_OFF, ARM_ON, leanFrom, nextArmed, seamFor } from '../src/lib/lean.js'
import { cityOf } from '../src/lib/warp.js'
import { buildGalaxy } from '../src/three/galaxy.js'

const line = (l) => [l.year, l.name, l.meta].filter(Boolean).join(' · ')

describe('route previews', () => {
  test('topside reads as a cv, in order', () => {
    const top = previewLines('top')
    assert.equal(top.length, 7)
    assert.equal(line(top[0]), '2020 · unthinkable · associate tech')
    assert.equal(line(top[5]), '2025 · tide · mobile engineer')
    assert.equal(line(top[6]), 'say hi · the end of the line, for now')
    const years = top.filter((l) => l.year).map((l) => Number(l.year))
    assert.deepEqual(years, [...years].sort((a, b) => a - b))
  })

  test('undercity reads as a contents page', () => {
    const under = previewLines('under')
    assert.equal(under.length, 6)
    assert.equal(line(under[0]), "delhi · where i'm from")
    assert.equal(line(under[3]), "side projects · the ones that didn't come back")
    assert.ok(under.every((l) => l.year === null))
  })

  test('every line is a real stop, and no gate', () => {
    for (const key of ['under', 'top']) {
      const ids = new Set(WORLDS[key].stops.filter((s) => s.kind !== 'gate').map((s) => s.id))
      for (const l of previewLines(key)) assert.ok(ids.has(l.id), `${key}/${l.id}`)
    }
  })
})

describe('the lean', () => {
  test('left is the undercity, right is topside, the middle is still', () => {
    assert.equal(leanFrom(0, 0, 1440, 900, false), -1)
    assert.equal(leanFrom(1440, 0, 1440, 900, false), 1)
    assert.equal(leanFrom(720, 450, 1440, 900, false), 0)
    // phones: topside is above
    assert.ok(leanFrom(0, 0, 390, 844, true) > 0.9)
    assert.ok(leanFrom(0, 844, 390, 844, true) < -0.9)
  })

  test('arming has hysteresis', () => {
    assert.equal(nextArmed(null, -ARM_ON), 'under')
    assert.equal(nextArmed(null, -(ARM_ON - 0.01)), null)
    assert.equal(nextArmed('under', -(ARM_OFF + 0.01)), 'under')
    assert.equal(nextArmed('under', -(ARM_OFF - 0.01)), null)
    assert.equal(nextArmed('under', ARM_ON), 'top')
  })

  test('leaning into a city widens it', () => {
    assert.ok(seamFor(-1) > 0.5)
    assert.ok(seamFor(1) < 0.5)
    assert.equal(seamFor(0), 0.5)
  })
})

describe('gaze', () => {
  const R = 100
  const FAR = 460
  test('follows the pointer around the face', () => {
    assert.equal(gazeFor(300, 0, R, FAR), 'look-right')
    assert.equal(gazeFor(600, 0, R, FAR), 'profile-right')
    assert.equal(gazeFor(200, -200, R, FAR), 'up-right')
    assert.equal(gazeFor(0, -300, R, FAR), 'look-up')
    assert.equal(gazeFor(-300, 0, R, FAR), 'look-left')
    assert.equal(gazeFor(-200, 300, R, FAR), 'look-down')
    assert.equal(gazeFor(0, 300, R, FAR), 'down-left')
    assert.equal(gazeFor(20, 20, R, FAR), 'front')
  })

  test('the cities, a little below the face, get a sideways look', () => {
    assert.equal(gazeFor(550, 255, R, FAR), 'profile-right')
    assert.equal(gazeFor(-550, 255, R, FAR), 'look-left')
  })

  test('a pointer on a sector edge keeps the face it has', () => {
    const edge = [Math.cos((70 * Math.PI) / 180) * 300, -Math.sin((70 * Math.PI) / 180) * 300]
    assert.equal(gazeFor(edge[0] + 1, edge[1], R, FAR, 'look-up'), 'look-up')
    assert.equal(gazeFor(edge[0] + 1, edge[1], R, FAR, 'up-right'), 'up-right')
  })
})

describe('cold open', () => {
  test('beats sit inside the intro, the ui comes last', () => {
    for (const [k, v] of Object.entries(INTRO)) {
      if (!Array.isArray(v)) continue
      assert.ok(v[0] >= 0 && v[1] <= INTRO.total && v[0] < v[1], k)
    }
    const ends = Object.values(INTRO).filter(Array.isArray).map((v) => v[1])
    assert.equal(Math.max(...ends), INTRO.chrome[1])
    assert.ok(INTRO.tear[0] < INTRO.flood[0] && INTRO.flood[0] < INTRO.name[0])
    assert.equal(beat(0, INTRO.name), 0)
    assert.equal(beat(INTRO.total, INTRO.name), 1)
  })

  test('dom keyframes are in order and end finished', () => {
    for (const { sel, frames } of INTRO_DOM) {
      const offsets = frames.map((f) => f.offset)
      assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b), sel)
      assert.equal(frames.at(-1).offset, 1)
      assert.equal(frames.at(-1).opacity, 1)
    }
  })
})

describe('deep links', () => {
  test('the warp colour ignores the query', () => {
    assert.equal(cityOf('/top?stop=tide'), 'top')
    assert.equal(cityOf('/under?stop=geo&fx=1'), 'under')
    assert.equal(cityOf('/play'), 'play')
  })

  test('every approach is inside the galaxy and short of its stop', () => {
    for (const key of ['under', 'top']) {
      const world = WORLDS[key]
      for (const stop of world.stops.filter((s) => s.kind !== 'gate')) {
        const [x, y] = approachPoint(world, stop.id)
        assert.ok(x >= world.bounds.x[0] && x <= world.bounds.x[1], `${key}/${stop.id} x`)
        assert.ok(y >= world.bounds.y[0] && y <= world.bounds.y[1], `${key}/${stop.id} y`)
        const gap = Math.hypot(stop.pos[0] - x, stop.pos[1] - y) - stop.r
        assert.ok(gap > 12 && gap <= APPROACH_GAP + 0.01, `${key}/${stop.id} gap ${gap}`)
        // clear of every other stop's near band, so it never docks somewhere else first
        for (const other of world.stops) {
          if (other.id === stop.id || other.kind === 'gate') continue
          assert.ok(Math.hypot(other.pos[0] - x, other.pos[1] - y) - other.r > 18, `${key}/${stop.id} near ${other.id}`)
        }
      }
    }
  })
})

describe('galaxies', () => {
  test('points stay in the unit disc and are deterministic', () => {
    for (const id of ['under', 'top']) {
      const a = buildGalaxy(id, 2000)
      const b = buildGalaxy(id, 2000)
      assert.deepEqual(a.pos, b.pos)
      for (let i = 0; i < 2000; i++) assert.ok(a.radius[i] <= 1 && a.radius[i] >= 0)
    }
  })
})
