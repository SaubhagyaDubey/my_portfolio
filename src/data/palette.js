// Every colour in the site. WebGL reads this module directly; src/styles/tokens.css mirrors BASE.
// Per-city values reach CSS as inline custom properties (see cityVars below).
//
// Two cities, after Arcane:
//   under = the undercity (Zaun): chem green, smog teal, rust plates, a shimmer-pink second light. This is "me".
//   top   = topside (Piltover): hextech blue light, brass plates, cream. This is "the work".
// One light accent per city colours flags, route, markers and the panel stroke. The plate is the material.

export const BASE = {
  ink: '#0a0b0f',
  paper: '#efe3cf',
  dim: '#c9bda6',
  faint: '#857a69',
  line: '#2b2520',
  brass: '#d9a84e',
  brassDeep: '#8a6424',
  core: '#fff3dc',
}

export const CITIES = {
  under: {
    accent: '#8ff07a',
    accent2: '#ff5fa8',
    glow: '#c8ff6a',
    inkTint: '#06151a',
    plate: ['#2a1d18', '#140f0d'],
    rivet: '#8a4a2b',
    sky: ['#081311', '#1a352a'],
    smog: '#2c5a44',
    starTint: '#9fe8c0',
    sunColor: '#e4ffe6',
    ambient: '#2c6b5a',
    sun: [-0.55, 0.45, 0.7],
    grade: { shadow: '#0b2a2c', mid: '#3f7a52', high: '#ff9fd0' },
    halation: '#ffc8e4',
    gateStyle: 'vent',
  },
  top: {
    accent: '#5fd7ff',
    accent2: '#e2b55a',
    glow: '#9ff1ff',
    inkTint: '#1a0f08',
    plate: ['#5e4220', '#2a1c0e'],
    rivet: '#f0cf86',
    sky: ['#120d09', '#3a2a18'],
    smog: '#7a5a2c',
    starTint: '#ffd9a0',
    sunColor: '#fff1d6',
    ambient: '#7a6040',
    sun: [0.5, 0.45, 0.72],
    grade: { shadow: '#2a1a10', mid: '#a6782f', high: '#8fe8ff' },
    halation: '#ffcf9a',
    gateStyle: 'gem',
  },
}

// Inline style object that hands a city's colours to CSS.
export function cityVars(key) {
  const c = CITIES[key]
  return {
    '--accent': c.accent,
    '--accent2': c.accent2,
    '--glow': c.glow,
    '--plate-a': c.plate[0],
    '--plate-b': c.plate[1],
    '--rivet': c.rivet,
    '--sky-a': c.sky[0],
    '--sky-b': c.sky[1],
  }
}
