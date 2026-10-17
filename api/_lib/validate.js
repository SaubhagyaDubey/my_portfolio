import { MIN_SECONDS_PER_WAVE, SCORE_UNIT, maxKills, maxScore } from '../../src/game/rules.js'

// Sanity checks on a submitted run. The game runs in the browser, so these can't stop a determined
// cheat; they stop the easy ones (edited numbers, replayed tokens, scores the game can't produce).

export const RUN_MAX_AGE = 4 * 60 * 60 * 1000 // a run token is good for four hours
const MAX_SCORE = 50_000_000
const MAX_WAVE = 999

const isInt = (n) => typeof n === 'number' && Number.isInteger(n)

// body: { score, wave, kills }. run: from readRun(). Returns { ok: true, score, wave, kills } or { ok: false, reason }.
export function checkRun(body, run, now) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'bad-body' }
  const { score, wave, kills } = body
  if (!isInt(score) || !isInt(wave) || !isInt(kills)) return { ok: false, reason: 'bad-numbers' }
  if (score < 0 || score > MAX_SCORE || wave < 1 || wave > MAX_WAVE || kills < 0) return { ok: false, reason: 'out-of-range' }
  if (score % SCORE_UNIT !== 0) return { ok: false, reason: 'impossible-score' }
  const age = now - run.startedAt
  if (age < 0 || age > RUN_MAX_AGE) return { ok: false, reason: 'run-expired' }
  const seconds = age / 1000
  if (seconds < (wave - 1) * MIN_SECONDS_PER_WAVE) return { ok: false, reason: 'too-fast' }
  if (kills > maxKills(wave, seconds)) return { ok: false, reason: 'too-many-kills' }
  if (score > maxScore(kills, wave)) return { ok: false, reason: 'impossible-score' }
  return { ok: true, score, wave, kills }
}
