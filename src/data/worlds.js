// The two galaxies. Everything a visitor can fly to lives here, in route order.
// Copy is first person, lowercase, short. It reads as one story when followed in order
// and still makes sense if someone lands on a stop out of order.
//
// fact is the plain, checkable line on each flag (company, role, dates, place). tag is the poetic one.
// pos is in world units on the flight plane (camera sits ~60 units above it).
// r is the object's visual radius, used for docking distance and the marker ring.

import { CITIES } from './palette.js'

export const WORLDS = {
  under: {
    ...CITIES.under,
    key: 'under',
    city: 'zaun',
    title: 'me',
    label: 'undercity · me',
    other: 'top',
    start: [-122, 0],
    bounds: { x: [-155, 125], y: [-108, 82] },
    stops: [
      {
        id: 'delhi',
        short: 'delhi',
        kind: 'earth',
        title: 'delhi',
        tag: "where i'm from",
        fact: 'new delhi · 28.61° n, 77.21° e',
        face: 'front',
        pos: [-90, 22],
        r: 7,
        story: [
          "this is where i'm from. that little light on the right side is delhi. loud, hot, a bit much, and i still like it more than most places i've been.",
          "most of what's out here started there. come on, i'll show you around.",
        ],
      },
      {
        id: 'why',
        short: 'the why',
        kind: 'quasar',
        title: 'the why',
        tag: 'how my head works',
        fact: 'how i think · questions before answers',
        face: 'look-up',
        pos: [-32, -30],
        r: 5,
        story: [
          "i can't leave something alone once i notice it works. i need to know why. an algorithm, how a company actually makes money, a pattern in the numbers on a bill. doesn't matter what it is, i'll pull on it until it gives.",
          'this is the thread through everything else out here, so i put it near the middle.',
        ],
      },
      {
        id: 'books',
        short: 'two books',
        kind: 'twin',
        title: 'two books',
        tag: 'what i keep re-reading',
        fact: 'two books · one ~2,000 yrs old, one ~150',
        face: 'thinking',
        pos: [24, 32],
        r: 4,
        story: [
          "two books i keep going back to. one is very old and says you're not the one doing things, you're the one watching them happen. the other is a hundred and fifty years old and says love what happens to you, all of it, as if you'd picked it yourself.",
          "i don't fully buy either. but between them they're why i build things without needing them to work out. you do the thing, you watch what happens, you don't sulk.",
        ],
      },
      {
        id: 'probe',
        short: "didn't come back",
        kind: 'probe',
        title: "the ones that didn't come back",
        tag: 'things i built that failed',
        fact: "side projects · the ones that didn't ship",
        face: 'look-down',
        pos: [80, -8],
        r: 4.5,
        story: [
          "so i build a lot, and not all of it comes back. this one didn't. i'd build it again tomorrow.",
          'each of these taught me something the next one needed. the ones that worked are up top. these are what made them work.',
        ],
      },
      {
        id: 'geo',
        short: 'geoguessr',
        kind: 'comet',
        title: 'the guessing game',
        tag: 'geoguessr, mostly',
        fact: 'geoguessr · most weeks',
        face: 'big-smile',
        pos: [40, -66],
        r: 3,
        story: [
          "i play geoguessr. they drop you somewhere on earth and you work out where from the road, the signs, the trees, the colour of the dirt. i'm decent at it.",
          "it's the same itch as the quasar back there. you read the place instead of being told. also it's just fun.",
        ],
      },
      {
        id: 'rules',
        short: 'the rules',
        kind: 'nebula',
        title: 'the rules',
        tag: 'why this place looks like this',
        fact: 'this site · rules written before code',
        face: 'wink',
        pos: [-45, -72],
        r: 14,
        story: [
          'i think most of the internet looks the same now. same fonts, same cards, same everything. i built this against that.',
          "before i wrote a line of it i wrote down the rules, and then i didn't cheat. that's what design is to me. you decide first. if you want to see what that looks like at work, the work is up through the gate.",
        ],
      },
      {
        id: 'gate',
        kind: 'gate',
        title: 'up to topside',
        tag: 'the work',
        fact: 'topside · the work, 2020 → now',
        face: 'look-right',
        pos: [-112, -52],
        r: 6,
        to: 'top',
        story: ["this goes to the work. it's a big part of me too, so go on through."],
      },
    ],
  },

  top: {
    ...CITIES.top,
    key: 'top',
    city: 'piltover',
    title: 'the work',
    label: 'topside · the work',
    other: 'under',
    start: [-142, -2],
    bounds: { x: [-168, 236], y: [-82, 72] },
    stops: [
      {
        id: 'unthinkable',
        short: 'unthinkable',
        kind: 'planet',
        title: 'unthinkable',
        tag: '2020 · where it started',
        fact: 'unthinkable solutions · associate tech · jan 2020 – sep 2021 · gurugram',
        face: 'front',
        pos: [-112, 26],
        r: 5,
        visual: { type: 'rocky', colors: ['#21403f', '#5f7f5a', '#c9a86a', '#efe3cf'], atmo: '#9fe0ff', seed: 3.1, freq: 2.2 },
        story: [
          'first job, gurugram, january 2020. nobody there did flutter, so i started it. taught it to the next person, then the next. by the time i left there were about twenty of us shipping with it.',
          "teaching something you learnt three months ago is a good way to find out what you actually understand. two of those people work with me today, which i'm quietly pleased about.",
        ],
      },
      {
        id: 'elixia',
        short: 'elixia',
        kind: 'planet',
        title: 'elixia',
        tag: '2021 · mumbai, from a desk in delhi',
        fact: 'elixia tech · senior flutter dev · sep 2021 – may 2022 · mumbai',
        face: 'look-down',
        pos: [-58, -32],
        r: 4.5,
        visual: { type: 'ice', colors: ['#34485a', '#6f8fa0', '#b8ccd2', '#f1e8da'], atmo: '#9ff1ff', ring: '#d9b77a', seed: 7.7, freq: 2.6 },
        story: [
          'then a mumbai company, mostly from a desk in delhi. three old angularjs apps moved over to flutter web. same features, quicker.',
          'also built a booking system for maersk so trucks stop jamming up outside warehouses. unglamorous. useful. i like that kind of work more than i admit.',
        ],
      },
      {
        id: 'supersix',
        short: 'super six',
        kind: 'planet',
        title: 'super six',
        tag: '2022 · sports apps, a million downloads',
        fact: 'super six sports gaming · flutter lead · may 2022 – oct 2023 · noida',
        face: 'big-smile',
        pos: [-4, 30],
        r: 9,
        visual: { type: 'gas', colors: ['#c97a3a', '#f0c987', '#7a3a1e', '#ffe6c4'], atmo: '#ffb070', seed: 1.3, freq: 1.0 },
        story: [
          '2022, noida. fantasy sports. a team of five and me shipped three apps: fantasy akhada, vusport, usq. fantasy akhada went past a million downloads.',
          "during a messi friendly we had a hundred thousand people watching live at the same time, and in ipl season the payments were moving five to ten crore a day. that year i learnt what 'at scale' actually means, and that i like running a team more than i expected.",
        ],
      },
      {
        id: 'ok2',
        short: 'ok2',
        kind: 'planet',
        title: 'ok2 health',
        tag: '2023 · fifty thousand lines down to seven',
        fact: 'ok2 health apps · flutter developer · oct 2023 – mar 2024 · remote',
        face: 'thinking',
        pos: [46, -36],
        r: 4,
        visual: { type: 'rocky', colors: ['#1e3a32', '#4f8a6a', '#b8c890', '#f2ead0'], atmo: '#8fe8d8', seed: 5.5, freq: 3.0 },
        story: [
          '2023, remote. a health app with fifty thousand lines of flutter in it. i took it down to seven thousand, same features, moved everything onto bloc so it made sense again.',
          'wrote some go on the backend too, because the work needed it and waiting on someone else felt silly.',
        ],
      },
      {
        id: 'dtdc',
        short: 'dtdc',
        kind: 'planet',
        title: 'dtdc',
        tag: '2024 · built a team from nothing',
        fact: 'dtdc · senior engineer, mobile lead · may 2024 – aug 2025 · gurugram',
        face: 'look-up',
        pos: [96, 26],
        r: 6,
        visual: { type: 'rocky', colors: ['#5a2a18', '#b5542a', '#e39a5b', '#f6e3c8'], atmo: '#ff9a6b', ring: '#d9a77a', seed: 9.2, freq: 2.0 },
        story: [
          "2024, gurugram, the courier company. no mobile team, so i built one. hired five people, decided how we'd ship, what a review looks like, when a release goes out.",
          'the app is for delivery folks. five thousand of them on the road at once, tracked live, with their territories sorted by the app instead of by hand.',
        ],
      },
      {
        id: 'tide',
        short: 'tide',
        kind: 'planet',
        title: 'tide',
        tag: 'now · a uk bank for small businesses',
        fact: 'tide · mobile engineer · aug 2025 – now · delhi ncr',
        face: 'front',
        pos: [142, -26],
        r: 5.5,
        visual: { type: 'rocky', colors: ['#13304a', '#2f6d8f', '#8fc8d8', '#f0e8d8'], atmo: '#9ff1ff', seed: 2.4, freq: 1.8 },
        story: [
          'now. tide, a uk bank for small businesses. i own how people subscribe, cancel, upgrade, add seats. helped it launch in germany.',
          "i'm also the person who writes the spec before anyone codes. people have mostly stopped fighting me on it. that habit came from the rules down in the undercity.",
        ],
      },
      {
        id: 'station',
        short: 'say hi',
        kind: 'station',
        title: 'say hi',
        tag: 'the end of the line, for now',
        fact: 'dubeysaubhagya@gmail.com · delhi ncr',
        face: 'wink',
        pos: [180, 22],
        r: 5,
        contact: true,
        story: ["that's the work so far. if any of it sounds like something you're building, write to me. i read everything."],
      },
      {
        id: 'gate',
        kind: 'gate',
        title: 'down to the undercity',
        tag: 'the rest of me',
        fact: 'undercity · the rest of me',
        face: 'look-left',
        pos: [206, -30],
        r: 6,
        to: 'under',
        story: ['this goes back to the rest of me.'],
      },
    ],
  },
}

export const LAUNCH = {
  name: 'Saubhagya Dubey',
  sub: 'somewhere out past the last app store',
  hello:
    "hi. i make apps, mostly in flutter, and i've been at it about six years. i built this small corner of space to tell you about myself. there are two sides. pick one, you can cross over later.",
  act: 'act i · a small corner of space · pick a side',
  idle: 'hover a side',
  under: "the undercity is me. where i'm from, what i read, why i can't leave things alone.",
  top: 'topside is the work. six places in six years, and what happened at each.',
  underTitle: 'me',
  topTitle: 'the work',
  underCity: 'the undercity',
  topCity: 'topside',
  hint: 'once you are in: hold and drag to fly, or tap a flag',
}

export const CONTACT = {
  email: 'dubeysaubhagya@gmail.com',
  linkedin: 'https://www.linkedin.com/in/saubhagyadubey/',
  github: 'https://github.com/saubhagyad',
}

export function stopsOf(worldKey) {
  return WORLDS[worldKey].stops
}

export function routeOf(worldKey) {
  // the visible route excludes the gate, which is a door rather than a stop
  return WORLDS[worldKey].stops.filter((s) => s.kind !== 'gate')
}

export function nextStop(worldKey, id) {
  const stops = WORLDS[worldKey].stops
  const i = stops.findIndex((s) => s.id === id)
  return stops[i + 1] ?? null
}
