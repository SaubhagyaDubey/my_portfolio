import { mulberry32 } from './seed.js'

// Hand-made-looking bitmaps, drawn once at startup and handed to CSS as custom properties:
//   --mask-panel / --mask-flag / --mask-plaque  torn-edge rectangles (story panel, flags, HUD, strip)
//   --mask-disc                                 torn-edge circle (portrait frames)
//   --mask-splash                               one paint splat for the scene change
//   --paper-tile                                tileable paper grain, used as a multiply layer
// Bitmap masks rather than SVG filters: they composite on the GPU and survive backdrop-filter in Safari.

function valueNoise1D(rand, n) {
  const pts = Array.from({ length: n }, () => rand())
  return (t) => {
    const x = (((t % 1) + 1) % 1) * n
    const i = Math.floor(x)
    const f = x - i
    const s = f * f * (3 - 2 * f)
    return pts[i % n] * (1 - s) + pts[(i + 1) % n] * s
  }
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

// A rectangle whose edges look torn from painted card: the outline wanders inward by a few pixels
// at two frequencies, and a handful of bites and specks break it further.
function tornRect(w, h, seed, depth = 7) {
  const [c, g] = canvas(w, h)
  const rand = mulberry32(seed)
  const lo = valueNoise1D(rand, 9)
  const hi = valueNoise1D(rand, 61)
  const per = 2 * (w + h)
  const pts = []
  const steps = 480
  for (let k = 0; k < steps; k++) {
    const d = (k / steps) * per
    const t = d / per
    const inset = depth * (0.35 + 0.45 * lo(t) + 0.35 * hi(t))
    let x
    let y
    if (d < w) [x, y] = [d, inset]
    else if (d < w + h) [x, y] = [w - inset, d - w]
    else if (d < 2 * w + h) [x, y] = [w - (d - w - h), h - inset]
    else [x, y] = [inset, h - (d - 2 * w - h)]
    pts.push([x, y])
  }
  g.fillStyle = '#000'
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
  g.fill()
  // bites out of the edge
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 18; i++) {
    const t = rand()
    const [x, y] = pts[Math.floor(t * pts.length)]
    g.beginPath()
    g.arc(x, y, 1.5 + rand() * depth * 0.8, 0, Math.PI * 2)
    g.fill()
  }
  // specks of paint just outside the edge
  g.globalCompositeOperation = 'source-over'
  for (let i = 0; i < 26; i++) {
    const [x, y] = pts[Math.floor(rand() * pts.length)]
    const cx = x + (x < w / 2 ? -1 : 1) * rand() * depth * 0.6
    const cy = y + (y < h / 2 ? -1 : 1) * rand() * depth * 0.6
    g.beginPath()
    g.arc(cx, cy, 0.6 + rand() * 1.4, 0, Math.PI * 2)
    g.fill()
  }
  return c.toDataURL('image/png')
}

function tornDisc(size, seed) {
  const [c, g] = canvas(size, size)
  const rand = mulberry32(seed)
  const lo = valueNoise1D(rand, 7)
  const hi = valueNoise1D(rand, 53)
  const r0 = size / 2 - 8
  g.fillStyle = '#000'
  g.beginPath()
  for (let k = 0; k <= 360; k++) {
    const t = k / 360
    const r = r0 - 6 * (0.3 + 0.5 * lo(t) + 0.3 * hi(t))
    const a = t * Math.PI * 2
    const x = size / 2 + Math.cos(a) * r
    const y = size / 2 + Math.sin(a) * r
    if (k) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.closePath()
  g.fill()
  return c.toDataURL('image/png')
}

// One splat: a lumpy core, lobes around it, droplets thrown further out, a few streaks.
function splat(size, seed) {
  const [c, g] = canvas(size, size)
  const rand = mulberry32(seed)
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.3
  g.fillStyle = '#000'
  const lo = valueNoise1D(rand, 11)
  g.beginPath()
  for (let k = 0; k <= 240; k++) {
    const t = k / 240
    const a = t * Math.PI * 2
    const r = R * (0.86 + 0.24 * lo(t))
    if (k) g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    else g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  g.fill()
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2
    const d = R * (0.85 + rand() * 0.25)
    g.beginPath()
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.1 + rand() * 0.2), 0, Math.PI * 2)
    g.fill()
  }
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2
    const len = R * (0.25 + rand() * 0.45)
    const w = R * (0.03 + rand() * 0.05)
    g.save()
    g.translate(cx, cy)
    g.rotate(a)
    g.beginPath()
    g.moveTo(R * 0.9, -w)
    g.lineTo(R * 0.9 + len, -w * 0.3)
    g.arc(R * 0.9 + len, 0, w * 0.9, -Math.PI / 2, Math.PI / 2)
    g.lineTo(R * 0.9, w)
    g.fill()
    g.restore()
  }
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2
    const d = R * (1.2 + rand() * 0.45)
    g.beginPath()
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.012 + rand() * 0.04), 0, Math.PI * 2)
    g.fill()
  }
  return c.toDataURL('image/png')
}

function paperTile(size, seed) {
  const [c, g] = canvas(size, size)
  const rand = mulberry32(seed)
  const img = g.createImageData(size, size)
  // coarse value noise, tileable by wrapping the lattice
  const L = 16
  const lat = Array.from({ length: L * L }, () => rand())
  const at = (i, j) => lat[((j % L) + L) % L * L + (((i % L) + L) % L)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * L
      const fy = (y / size) * L
      const i = Math.floor(fx)
      const j = Math.floor(fy)
      const u = fx - i
      const v = fy - j
      const su = u * u * (3 - 2 * u)
      const sv = v * v * (3 - 2 * v)
      const n = at(i, j) * (1 - su) * (1 - sv) + at(i + 1, j) * su * (1 - sv) + at(i, j + 1) * (1 - su) * sv + at(i + 1, j + 1) * su * sv
      const grain = rand()
      const val = 200 + n * 40 + grain * 15
      const k = (y * size + x) * 4
      img.data[k] = val
      img.data[k + 1] = val * 0.97
      img.data[k + 2] = val * 0.9
      img.data[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

let installed = false

export function installTextures() {
  if (installed || typeof document === 'undefined') return
  installed = true
  const root = document.documentElement.style
  const set = (name, url) => root.setProperty(name, `url("${url}")`)
  try {
    set('--mask-panel', tornRect(420, 640, 11, 8))
    set('--mask-flag', tornRect(260, 64, 23, 4))
    set('--mask-plaque', tornRect(720, 56, 37, 4))
    set('--mask-disc', tornDisc(256, 41))
    set('--mask-splash', splat(512, 53))
    set('--paper-tile', paperTile(192, 67))
  } catch {
    // no canvas: CSS falls back to plain shapes
  }
}
