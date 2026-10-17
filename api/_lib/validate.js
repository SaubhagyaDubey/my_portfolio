import { BETWEEN_WAVES, BOSS_CALL, BOSS_COMBO, BOSS_DYING, BOSS_EVERY, FIRST_WAVE_DELAY, MAX_HITS_PER_SECOND, MAX_MULT, SCORES, SCORE_UNIT, SPLITTER_CHILDREN, bossHp, bossSpecialCap, multiplier } from '../../src/game/rules.js'
import { buildWave } from '../../src/game/waveplan.js'

// Sanity checks on a submitted run, derived from the game's own wave plan. The game runs in the browser,
// so a determined cheat can still submit a perfect-play run; these stop numbers the game cannot produce:
// too many kills for the waves reached, more points than those kills can earn, waves reached too soon.

export const RUN_MAX_AGE = 4 * 60 * 60 * 1000 // a run token is good for four hours
export const MAX_WAVE = 999
// Wall-clock slack: the token is issued a moment before the run starts (and can be issued late on a cold
// start), so allow a little less time than the plan says.
const TIME_FACTOR = 0.9
const TIME_GRACE = 3

const VALUES = [SCORES.splitter, SCORES.spitter, SCORES.dart, SCORES.jelly] // highest first
const zeroPool = () => Object.fromEntries(VALUES.map((v) => [v, 0]))

// plan.start[w]: the earliest game time wave w can begin. plan.pool[w]: creatures available through wave w,
// counted by score value (splitters' darts included; boss-called darts depend on time and are added later).
const plan = { start: [0, FIRST_WAVE_DELAY], pool: [zeroPool()] }

function ensure(w) {
  while (plan.pool.length <= w) {
    const n = plan.pool.length
    const pool = { ...plan.pool[n - 1] }
    const events = buildWave(n)
    let shortest
    if (n % BOSS_EVERY === 0) {
      // the leviathan appears, eats its full share of pickup weapons at once, takes every other hit as fast as
      // twin cannons can land them, then dies
      shortest = events[0].t + (bossHp(n) - bossSpecialCap(n)) / MAX_HITS_PER_SECOND + BOSS_DYING
    } else {
      // every creature has to spawn before the wave can clear; one can die the moment it appears
      for (const e of events) {
        pool[SCORES[e.kind]] += 1
        if (e.kind === 'splitter') pool[SCORES.dart] += SPLITTER_CHILDREN
      }
      shortest = events.length ? events[events.length - 1].t : 0
    }
    plan.pool.push(pool)
    plan.start.push(plan.start[n] + shortest + BETWEEN_WAVES)
  }
}

// Earliest wall-clock seconds after launch that a run could report this wave.
export function minSeconds(wave) {
  ensure(wave)
  return Math.max(0, plan.start[wave] * TIME_FACTOR - TIME_GRACE)
}

// Creatures a run could have killed by this wave in this many seconds, by score value.
function poolFor(wave, seconds) {
  ensure(wave)
  const pool = { ...plan.pool[wave] }
  if (wave >= BOSS_EVERY) pool[SCORES.dart] += BOSS_CALL.darts * Math.ceil(seconds / BOSS_CALL.every)
  return pool
}

export function maxKills(wave, seconds) {
  const pool = poolFor(wave, seconds)
  return VALUES.reduce((n, v) => n + pool[v], 0)
}

// The most `kills` kills can be worth: the most valuable creatures in the pool, taken in one unbroken streak
// so each lands on the highest multiplier it could have (boss kills add their streak bonus up front).
export function maxScore(kills, wave, seconds) {
  const pool = poolFor(wave, seconds)
  const bosses = Math.floor(wave / BOSS_EVERY)
  let total = bosses * SCORES.boss * MAX_MULT
  let i = kills // the last kill in the streak has the highest multiplier; give it the best creature
  for (const v of VALUES) {
    let n = Math.min(pool[v], i)
    for (; n > 0; n--, i--) total += v * multiplier(i + bosses * BOSS_COMBO)
    if (i <= 0) break
  }
  return total
}

const isInt = (n) => typeof n === 'number' && Number.isInteger(n)

// body: { score, wave, kills }. run: from readRun(). Returns { ok: true, score, wave, kills } or { ok: false, reason }.
export function checkRun(body, run, now) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'bad-body' }
  const { score, wave, kills } = body
  if (!isInt(score) || !isInt(wave) || !isInt(kills)) return { ok: false, reason: 'bad-numbers' }
  if (score < 0 || wave < 1 || wave > MAX_WAVE || kills < 0) return { ok: false, reason: 'out-of-range' }
  if (score % SCORE_UNIT !== 0) return { ok: false, reason: 'impossible-score' }
  const age = now - run.startedAt
  if (age < 0 || age > RUN_MAX_AGE) return { ok: false, reason: 'run-expired' }
  const seconds = age / 1000
  if (seconds < minSeconds(wave)) return { ok: false, reason: 'too-fast' }
  if (kills > maxKills(wave, seconds)) return { ok: false, reason: 'too-many-kills' }
  if (score > maxScore(kills, wave, seconds)) return { ok: false, reason: 'impossible-score' }
  return { ok: true, score, wave, kills }
}
