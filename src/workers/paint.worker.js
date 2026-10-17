// Paints a portrait frame off the main thread so the placeholders match the painted scene:
// generalised Kuwahara (same idea as src/three/post/PaintEffect.js), a light posterise,
// darker ink where luminance edges are, and a warm lift toward paper. Alpha is kept as is.

const R = 3

function kuwahara(src, w, h) {
  const out = new Uint8ClampedArray(src.length)
  const n = (R + 1) * (R + 1)
  const m = new Float32Array(12)
  const s = new Float32Array(12)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4
      out[k + 3] = src[k + 3]
      if (src[k + 3] === 0) continue
      m.fill(0)
      s.fill(0)
      for (let j = -R; j <= R; j++) {
        const yy = Math.min(h - 1, Math.max(0, y + j))
        for (let i = -R; i <= R; i++) {
          const xx = Math.min(w - 1, Math.max(0, x + i))
          const q = (yy * w + xx) * 4
          const a = src[q + 3] / 255
          const r = (src[q] / 255) * a
          const g = (src[q + 1] / 255) * a
          const b = (src[q + 2] / 255) * a
          const add = (z) => {
            m[z * 3] += r
            m[z * 3 + 1] += g
            m[z * 3 + 2] += b
            s[z * 3] += r * r
            s[z * 3 + 1] += g * g
            s[z * 3 + 2] += b * b
          }
          if (i <= 0 && j <= 0) add(0)
          if (i >= 0 && j <= 0) add(1)
          if (i <= 0 && j >= 0) add(2)
          if (i >= 0 && j >= 0) add(3)
        }
      }
      let wr = 0
      let wg = 0
      let wb = 0
      let wsum = 0
      for (let z = 0; z < 4; z++) {
        const mr = m[z * 3] / n
        const mg = m[z * 3 + 1] / n
        const mb = m[z * 3 + 2] / n
        const v =
          0.299 * Math.abs(s[z * 3] / n - mr * mr) + 0.587 * Math.abs(s[z * 3 + 1] / n - mg * mg) + 0.114 * Math.abs(s[z * 3 + 2] / n - mb * mb)
        const wt = 1 / (1 + Math.pow(v * 260, 2))
        wr += mr * wt
        wg += mg * wt
        wb += mb * wt
        wsum += wt
      }
      const a = src[k + 3] / 255 || 1
      out[k] = (wr / wsum / a) * 255
      out[k + 1] = (wg / wsum / a) * 255
      out[k + 2] = (wb / wsum / a) * 255
    }
  }
  return out
}

function finish(px, w, h) {
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255
  const L = (x, y) => lum[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  const out = new Uint8ClampedArray(px)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4
      if (px[k + 3] === 0) continue
      const gx = L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1)
      const gy = L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1) - L(x - 1, y + 1) - 2 * L(x, y + 1) - L(x + 1, y + 1)
      const e = Math.min(1, Math.max(0, (Math.hypot(gx, gy) - 0.25) * 2.2))
      for (let c = 0; c < 3; c++) {
        let v = px[k + c] / 255
        const q = Math.round(v * 6) / 6
        v = v * 0.55 + q * 0.45 // posterise halfway
        v = v * (1 - e * 0.55) // ink on edges
        const paper = [0.94, 0.89, 0.81][c]
        v = v * 0.93 + paper * 0.07 * v + (c === 0 ? 0.012 : 0) // warm lift
        out[k + c] = Math.min(255, v * 255)
      }
    }
  }
  return out
}

self.onmessage = async (e) => {
  const { name, url } = e.data
  try {
    const blob = await (await fetch(url)).blob()
    const bmp = await createImageBitmap(blob)
    const w = bmp.width
    const h = bmp.height
    const c = new OffscreenCanvas(w, h)
    const g = c.getContext('2d')
    g.drawImage(bmp, 0, 0)
    const img = g.getImageData(0, 0, w, h)
    const painted = finish(kuwahara(img.data, w, h), w, h)
    img.data.set(painted)
    g.putImageData(img, 0, 0)
    const out = await c.convertToBlob({ type: 'image/webp', quality: 0.9 })
    self.postMessage({ name, blob: out })
  } catch (err) {
    self.postMessage({ name, error: String(err) })
  }
}
