// Every colour in the site. WebGL reads this module directly; src/styles/tokens.css mirrors BASE.
// Per-city values reach CSS as inline custom properties (see cityVars below).
//
// Two cities, after Arcane:
//   under = the undercity (Zaun): chem green, smog teal, gunmetal plates, a shimmer-pink second light. This is "me".
//   top   = topside (Piltover): hextech blue light, steel plates, blue-white. This is "the work".
// One light accent per city colours flags, route, markers and the panel stroke. The plate is the material.
// The neutrals are black, grey, white and blue-white; nothing in the chrome is brown or beige.

export const BASE = {
  ink: '#0a0b0f',
  paper: '#eef2f8',
  dim: '#aeb6c2',
  faint: '#6c7380',
  line: '#24272d',
  steel: '#bcd4f6',
  steelDeep: '#56677f',
  core: '#f3f7ff',
}

export const CITIES = {
  under: {
    accent: '#8ff07a',
    accent2: '#ff5fa8',
    glow: '#c8ff6a',
    inkTint: '#06151a',
    plate: ['#23262c', '#121418'],
    rivet: '#6e7682',
    sky: ['#081311', '#1a352a'],
    smog: '#2c5a44',
    starTint: '#9fe8c0',
    sunColor: '#e4ffe6',
    ambient: '#2c6b5a',
    sun: [-0.55, 0.45, 0.7],
    grade: { shadow: '#0b2a2c', mid: '#3f7a52', high: '#ff9fd0' },
    halation: '#ffc8e4',
    gateStyle: 'vent',
    // the poster title's two hatched shadows, down-left then up-right
    shade: ['#ff5fa8', '#8ff07a'],
  },
  top: {
    accent: '#5fd7ff',
    accent2: '#dce8ff',
    glow: '#9ff1ff',
    inkTint: '#0b1018',
    plate: ['#3a4250', '#1a1e26'],
    rivet: '#d4deec',
    sky: ['#07090d', '#1e2633'],
    smog: '#5c6b82',
    starTint: '#dfe9ff',
    sunColor: '#f2f6ff',
    ambient: '#4f5a6c',
    sun: [0.5, 0.45, 0.72],
    grade: { shadow: '#0e1522', mid: '#6f7f96', high: '#8fe8ff' },
    halation: '#d8e6ff',
    gateStyle: 'gem',
    shade: ['#ffd166', '#5fd7ff'],
  },
}

// The shooter's lanes. The lane changes colour after every wave: ordinary waves walk this ring starting from
// the city you launched in, and every leviathan wave is REDLINE. Each lane keeps the player's bolts (`glow`)
// and the enemy's light (`accent2`) far apart in hue so shots never read as threats. Topside's own accent2 is
// blue-white, too close to its cyan bolts, so its lane lights the enemy in gold instead.
export const LANES = [
  { name: 'the undercity', city: 'under', ...CITIES.under },
  {
    name: 'the firelights',
    accent: '#ff9b45',
    accent2: '#3fe3d2',
    glow: '#ffd27a',
    sky: ['#140906', '#3d1a0c'],
    smog: '#7a3416',
    starTint: '#ffc89a',
    sunColor: '#ffe4c8',
    ambient: '#6e3a1e',
    grade: { shadow: '#2c120a', mid: '#a5532a', high: '#7ff3e4' },
  },
  {
    name: 'the shimmer haze',
    accent: '#d07dff',
    accent2: '#ff4f6d',
    glow: '#f0c2ff',
    sky: ['#0f0818', '#2c1446'],
    smog: '#4f2a78',
    starTint: '#dcbcff',
    sunColor: '#f3e6ff',
    ambient: '#4d3276',
    grade: { shadow: '#1c0f32', mid: '#6e40a2', high: '#ff94b4' },
  },
  {
    name: 'the low tide',
    accent: '#3ff0c4',
    accent2: '#ff7a52',
    glow: '#a8ffe8',
    sky: ['#03110f', '#0c3a35'],
    smog: '#155c52',
    starTint: '#a6f2e0',
    sunColor: '#e4fff8',
    ambient: '#1e5a50',
    grade: { shadow: '#06201e', mid: '#2a8a72', high: '#ffb08c' },
  },
  { name: 'topside', city: 'top', ...CITIES.top, accent2: '#ffd166' },
  {
    name: 'the sump',
    accent: '#e6f24a',
    accent2: '#ff3db4',
    glow: '#f7ff9e',
    sky: ['#0d0e05', '#2c300f'],
    smog: '#545a1a',
    starTint: '#eef0a6',
    sunColor: '#fbffe2',
    ambient: '#4c4e24',
    grade: { shadow: '#1a1b08', mid: '#7c7e2a', high: '#ff8fd2' },
  },
]

export const REDLINE = {
  name: 'redline',
  accent: '#ff4d4d',
  accent2: '#ffb02e',
  glow: '#8cf2ff',
  sky: ['#140506', '#3e0f12'],
  smog: '#6e1a1e',
  starTint: '#ffb0a0',
  sunColor: '#ffe0d8',
  ambient: '#5e2024',
  grade: { shadow: '#2a0a0c', mid: '#9a2a2a', high: '#ffc070' },
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
    '--shade-a': c.shade[0],
    '--shade-b': c.shade[1],
  }
}
