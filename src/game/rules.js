// The game's rules as plain data, shared by the game and the leaderboard API. The server derives its
// sanity checks from these (and from the wave plan in waveplan.js), so they can never drift from what
// the game actually does. No imports beyond plain modules: the API loads this file too.

export const SCORES = { jelly: 100, dart: 150, spitter: 300, splitter: 400, boss: 5000 }
export const BOSS_EVERY = 5 // every fifth wave is the leviathan
export const COMBO_STEP = 5 // every 5 kills in a streak adds 1 to the multiplier
export const MAX_MULT = 8
export const BOSS_COMBO = 10 // a boss kill adds this much streak
export const SPLITTER_CHILDREN = 3 // darts a splitter breaks into

export const multiplier = (combo) => 1 + Math.min(MAX_MULT - 1, Math.floor(combo / COMBO_STEP))

// Every score the game can award is a multiple of this (100, 150, 300, 400, 5000 times an integer).
export const SCORE_UNIT = 50

// ---- timing (seconds of game time)
export const FIRST_WAVE_DELAY = 1.2 // launch → wave 1
export const BETWEEN_WAVES = 2.4 // wave cleared → next wave
export const FIRE_CD = 0.095 // one cannon at a time, alternating
export const TWIN_FIRE_CD = 0.075 // both cannons per shot while twin cannons are up
export const BOSS_DYING = 2.4 // the leviathan's death throes before the lane clears
export const BOSS_CALL = { first: 7, every: 7.5, darts: 4 } // the leviathan calls darts while it lives
export const bossHp = (wave) => {
  const cycle = Math.max(1, Math.round(wave / BOSS_EVERY))
  return 70 + (cycle - 1) * 35
}
// fastest possible damage: both cannons every TWIN_FIRE_CD
export const MAX_HITS_PER_SECOND = 2 / TWIN_FIRE_CD

// ---- the lane
export const BOX = { x: 12, y: 6.5 } // how far the ship can slide from centre
