// Scoring rules shared by the game and the leaderboard API, so the server's sanity checks can never
// drift from what the game actually awards. Plain data only: the API imports this file too.

export const SCORES = { jelly: 100, dart: 150, spitter: 300, splitter: 400, boss: 5000 }
export const BOSS_EVERY = 5 // every fifth wave is the leviathan
export const COMBO_STEP = 5 // every 5 kills in a streak adds 1 to the multiplier
export const MAX_MULT = 8
export const BOSS_COMBO = 10 // a boss kill adds this much streak

export const multiplier = (combo) => 1 + Math.min(MAX_MULT - 1, Math.floor(combo / COMBO_STEP))

// Every score the game can award is a multiple of this (100, 150, 300, 400, 5000 times an integer).
export const SCORE_UNIT = 50
const MAX_KILL = Math.max(SCORES.jelly, SCORES.dart, SCORES.spitter, SCORES.splitter)

// The most a run could possibly score with this many kills by this wave. Generous on purpose:
// it only rejects numbers the game cannot produce.
export function maxScore(kills, wave) {
  const bosses = Math.floor(wave / BOSS_EVERY)
  return kills * MAX_KILL * MAX_MULT + bosses * SCORES.boss * MAX_MULT
}

// The fewest seconds a run needs to reach a wave: each wave takes at least this long to fly through.
export const MIN_SECONDS_PER_WAVE = 6
// Kills a run could have: the biggest ordinary wave is ~130 creatures plus splitter darts, and a boss
// keeps calling darts (4 every 7.5 s) for as long as it lives, so time adds to the ceiling too.
export const MAX_KILLS_PER_WAVE = 160
export const maxKills = (wave, seconds) => wave * MAX_KILLS_PER_WAVE + Math.ceil(seconds)
