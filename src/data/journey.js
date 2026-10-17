// The home page is a ride. You take off from the cockpit, stop four times, and end at a fork: me, the work, or
// the game. Each stop is one card in the middle of the canopy with one thing flying past outside it.
// The work stops' fact lines are the same ones their flags carry in topside (worlds.js), so they can't drift.
//
// body: what's outside the canopy while you're stopped. `at` is where it sits on screen (-1..1 from the
// centre, y up) and `size` its radius as a fraction of half the screen's height. The look and colours come
// from the galaxy stop named by `world` + `stop`.
// air: the sky, haze, ambient light and grade the scene blends to on the way in (src/three/air.js).

import { CITIES } from './palette.js'
import { LAUNCH, WORLDS } from './worlds.js'

const find = (world, id) => WORLDS[world].stops.find((s) => s.id === id)

// the sky before take-off and at the fork: cool and cityless
export const OPEN_AIR = {
  sky: ['#05070b', '#152033'],
  smog: '#3d4c66',
  ambient: '#4f5a6c',
  grade: { shadow: '#0e1522', mid: '#5f6f86', high: '#d4e4ff' },
}

export const JOURNEY = [
  {
    id: 'hello',
    short: 'hello',
    city: null,
    kicker: "hi, i'm",
    title: 'Saubhagya Dubey',
    line: 'i make apps, mostly in flutter. six years, three mobile teams built from nothing.',
    fact: 'mobile engineer · new delhi · 28.61° n, 77.21° e',
    body: { kind: 'earth', world: 'under', stop: 'delhi', at: [-0.66, -0.64], size: 0.66 },
    air: find('under', 'delhi').air,
  },
  {
    id: 'supersix',
    short: 'super six',
    city: 'top',
    kicker: '2022 · fantasy sports',
    title: 'A million downloads',
    line: 'a team of five and me. a hundred thousand people watching live during a messi friendly.',
    fact: find('top', 'supersix').fact,
    body: { kind: 'planet', world: 'top', stop: 'supersix', at: [0.7, 0.34], size: 0.44 },
    air: find('top', 'supersix').air,
  },
  {
    id: 'tide',
    short: 'tide',
    city: 'top',
    kicker: 'now',
    title: 'Tide',
    line: 'a uk bank for small businesses. i own how people subscribe, cancel and upgrade. helped launch it in germany.',
    fact: find('top', 'tide').fact,
    body: { kind: 'planet', world: 'top', stop: 'tide', at: [0.66, -0.5], size: 0.42 },
    air: find('top', 'tide').air,
  },
  {
    id: 'why',
    short: 'the why',
    city: 'under',
    kicker: 'off the clock',
    title: 'The why',
    line: "i can't leave something alone once i notice it works. i need to know why.",
    fact: 'two old books, re-read · geoguessr, most weeks · this site, rules first',
    body: { kind: 'quasar', world: 'under', stop: 'why', at: [0.6, 0.36], size: 0.11 },
    air: CITIES.under,
  },
]

export const READY = {
  kicker: 'saubhagya dubey · deep field',
  key: 'hold space',
  touchKey: 'tap',
  line: "or click. i'll show you around.",
  touchLine: "i'll show you around.",
  time: 'about half a minute',
  escape: 'esc skips it',
}

export const FORK = {
  kicker: "that's the short version",
  line: 'there is more on both sides. pick one, you can cross over later.',
  under: { city: LAUNCH.underCity, title: LAUNCH.underTitle, blurb: LAUNCH.under },
  top: { city: LAUNCH.topCity, title: LAUNCH.topTitle, blurb: LAUNCH.top },
  play: { title: LAUNCH.playTitle, blurb: 'or neither: fly the ship, shoot what glows' },
}
