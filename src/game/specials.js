// One-shot pickups. Weapons go on a rack (up to MAX_HELD) and fire with E, right-click or the rack button,
// oldest first. Upgrades sit on the ship until the moment they're needed. Either way each one works once.
// How much any of them can hurt the leviathan is capped in rules.js (bossSpecialCap), so the leaderboard
// can still bound how fast a boss wave can end.

export const MAX_HELD = 3

export const SPECIALS = {
  nova: { type: 'weapon', label: 'nova', hint: 'wipes the lane in front of you', color: '#f3f7ff' },
  lance: { type: 'weapon', label: 'lance', hint: 'a beam through anything in line', color: '#7ad8ff' },
  swarm: { type: 'weapon', label: 'swarm', hint: 'twelve seekers that pick their own targets', color: '#ff9a3c' },
  shield: { type: 'upgrade', label: 'shield', hint: 'eats the next hit', color: '#b48cff' },
  wind: { type: 'upgrade', label: 'second wind', hint: 'one more go when the hull runs out', color: '#ffd36b' },
}

export const NOVA = { speed: 720, boss: 14 } // the ring runs down the lane at `speed`; one hit on the boss as it passes
export const LANCE = { time: 1.6, tick: 0.08, r: 1.6, damage: 2, boss: 1, len: 420 }
export const SWARM = { n: 12, speed: 170, turn: 6, life: 3.2, damage: 3, boss: 2 }
export const SHIELD_R = 2
