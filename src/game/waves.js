import { BOSS_EVERY } from './rules.js'

// Wave titles. The spawn plan itself lives in waveplan.js, which the leaderboard API shares.
export { buildWave } from './waveplan.js'
export { BOSS_EVERY }

export function waveLabel(n) {
  return n % BOSS_EVERY === 0 ? { text: `wave ${n}`, sub: 'something big is coming up the lane' } : { text: `wave ${n}`, sub: WAVE_SUBS[(n - 1) % WAVE_SUBS.length] }
}

const WAVE_SUBS = [
  'jellies first. they mostly drift.',
  'darts fly in lines. lead them.',
  'the spiky ones stop and spit.',
  'hit the armoured ones and they split.',
  'all of it at once now.',
  'keep the combo going.',
  'roll with shift to slip through.',
]
