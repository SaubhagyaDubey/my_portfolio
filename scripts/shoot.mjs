// Headless Chrome driver over the DevTools protocol (no puppeteer needed). macOS Chrome path below.
// Flies through both galaxies and saves screenshots so visual changes can be checked without a browser open.
// Usage: node shoot.mjs <baseUrl> <outDir> [scenario...]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const [base = 'http://localhost:5173', outDir = 'shots', ...only] = process.argv.slice(2)
const port = 9333
fs.mkdirSync(outDir, { recursive: true })

const chrome = spawn(
  CH,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${process.env.TMPDIR ?? '/tmp'}/deepfield-chrome`,
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore' },
)
process.on('exit', () => chrome.kill())

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForChrome() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/json/version`)
      if (r.ok) return
    } catch {}
    await sleep(150)
  }
  throw new Error('chrome did not start')
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.handlers = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
      } else if (msg.method && this.handlers.has(msg.method)) {
        for (const h of this.handlers.get(msg.method)) h(msg.params)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }
  on(method, h) {
    if (!this.handlers.has(method)) this.handlers.set(method, [])
    this.handlers.get(method).push(h)
  }
}

async function openTab() {
  const r = await fetch(`http://localhost:${port}/json/new?about:blank`, { method: 'PUT' })
  const info = await r.json()
  const ws = new WebSocket(info.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res)
    ws.addEventListener('error', rej)
  })
  const cdp = new CDP(ws)
  cdp.targetId = info.id
  const logs = []
  cdp.logs = logs
  await cdp.send('Runtime.enable')
  await cdp.send('Page.enable')
  await cdp.send('Log.enable')
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning') logs.push(`${p.type}: ${p.args.map((a) => a.value ?? a.description ?? '').join(' ')}`)
  })
  cdp.on('Runtime.exceptionThrown', (p) => logs.push(`exception: ${p.exceptionDetails.text} ${p.exceptionDetails.exception?.description ?? ''}`))
  cdp.on('Log.entryAdded', (p) => {
    if (p.entry.level === 'error') logs.push(`log: ${p.entry.text} ${p.entry.url ?? ''}`)
  })
  return cdp
}

async function closeTab(cdp) {
  try {
    await fetch(`http://localhost:${port}/json/close/${cdp.targetId}`)
  } catch {}
  cdp.ws.close()
}

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(data, 'base64'))
  console.log(`shot ${name}`)
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  return r.result?.value
}

async function waitFor(cdp, expression, timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await evaluate(cdp, expression)) return true
    await sleep(250)
  }
  console.log(`  (timed out waiting for ${expression})`)
  return false
}

async function flyAndWait(cdp, title, id) {
  await click(cdp, `.flag[aria-label="fly to ${title}"]`)
  await waitFor(cdp, `window.__deepfield?.useStore.getState().docked === ${JSON.stringify(id)}`)
  await sleep(900)
}

async function click(cdp, selector) {
  const ok = await evaluate(
    cdp,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true })()`,
  )
  if (!ok) console.log(`  (no element for ${selector})`)
}

async function hover(cdp, selector) {
  const box = await evaluate(
    cdp,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })()`,
  )
  if (!box) return console.log(`  (no element for ${selector})`)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
}

async function drag(cdp, from, to, ms = 1200) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 })
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps
    const y = from.y + ((to.y - from.y) * i) / steps
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' })
    await sleep(ms / steps)
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 })
}

const scenarios = {
  // the home page's ride: ready, holding space, in flight, every stop's card, the fork, a side lit, then into it
  async home(cdp) {
    // read through J; assign through W (an optional chain can't be assigned to)
    const J = 'window.__journey?.current'
    const W = 'window.__journey.current'
    await cdp.send('Page.navigate', { url: `${base}/?journey=1` })
    await waitFor(cdp, J, 10000)
    await sleep(2500)
    await shot(cdp, 'home-ready')
    await evaluate(cdp, `${W}.holding = true`)
    await waitFor(cdp, `${J}.charge > 0.55`, 10000)
    await shot(cdp, 'home-charge')
    await waitFor(cdp, `${J}.phase === 'fly' && ${J}.u > 0.35`, 20000)
    await evaluate(cdp, `${W}.holding = false`)
    await shot(cdp, 'home-fly')
    for (let i = 0; i < 4; i++) {
      await waitFor(cdp, `${J}.phase === 'dwell' && ${J}.i === ${i}`, 40000)
      await sleep(1600)
      await shot(cdp, `home-stop-${i}`)
      const fit = await evaluate(cdp, `(() => { const t = document.querySelector('.journey-card[data-on="true"] .journey-card__title'); if (!t) return null; const g = document.createRange(); g.selectNodeContents(t); const r = g.getBoundingClientRect(); const b = t.getBoundingClientRect(); return { fs: parseFloat(t.style.fontSize), lines: Math.round(r.height / (parseFloat(t.style.fontSize) * 0.86)), spill: Math.round(Math.max(r.right - b.right, b.left - r.left)) } })()`)
      console.log(`  stop ${i}: ${JSON.stringify(fit)}`)
      await click(cdp, '.journey-hud__next')
    }
    await waitFor(cdp, `${J}.phase === 'fork'`, 40000)
    await sleep(1800)
    await shot(cdp, 'home-fork')
    await hover(cdp, '.journey-choice--top .journey-choice__title')
    await sleep(1500)
    await shot(cdp, 'home-fork-top')
    await click(cdp, '.journey-choice--top')
    await waitFor(cdp, `${J}?.t > 0.5`, 10000)
    await shot(cdp, 'home-leave')
    await waitFor(cdp, `location.pathname === '/top'`, 15000)
    console.log('  path after the fork:', await evaluate(cdp, 'location.pathname'))
    await cdp.send('Page.navigate', { url: `${base}/` })
    await sleep(2500)
    console.log('  second visit opens at:', await evaluate(cdp, `${J}?.phase`))
  },
  // a preview link: lands docked at that stop, with ?stop dropped and ?fx kept
  async deeplink(cdp) {
    for (const [path, id] of [['/top?stop=tide&fx=1', 'tide'], ['/under?stop=geo', 'geo']]) {
      await cdp.send('Page.navigate', { url: `${base}${path}` })
      await waitFor(cdp, `window.__deepfield?.useStore.getState().docked === ${JSON.stringify(id)}`, 40000)
      await sleep(900)
      await shot(cdp, `deeplink-${id}`)
      console.log(`  ${path} → ${await evaluate(cdp, 'location.pathname + location.search')}, docked ${await evaluate(cdp, 'window.__deepfield?.useStore.getState().docked')}`)
    }
  },
  async under(cdp) {
    await cdp.send('Page.navigate', { url: `${base}/under` })
    await sleep(4500)
    await shot(cdp, 'under-arrive')
    await flyAndWait(cdp, 'delhi', 'delhi')
    await shot(cdp, 'under-delhi')
    await click(cdp, '.story .btn--primary')
    await waitFor(cdp, `window.__deepfield?.useStore.getState().docked === 'why'`)
    await sleep(900)
    await shot(cdp, 'under-why')
    await flyAndWait(cdp, 'two books', 'books')
    await shot(cdp, 'under-books')
    await flyAndWait(cdp, 'the rules', 'rules')
    await shot(cdp, 'under-rules')
    await flyAndWait(cdp, 'up to topside', 'gate')
    await shot(cdp, 'under-gate')
    console.log('  fps:', await evaluate(cdp, 'window.__deepfield?.sim.fps?.toFixed(1)'))
  },
  async top(cdp) {
    await cdp.send('Page.navigate', { url: `${base}/top` })
    await sleep(4500)
    await shot(cdp, 'top-arrive')
    await flyAndWait(cdp, 'super six', 'supersix')
    await shot(cdp, 'top-supersix')
    await flyAndWait(cdp, 'elixia', 'elixia')
    await shot(cdp, 'top-elixia')
    await flyAndWait(cdp, 'say hi', 'station')
    await shot(cdp, 'top-station')
    await flyAndWait(cdp, 'dtdc', 'dtdc')
    await shot(cdp, 'top-dtdc')
    await flyAndWait(cdp, 'down to the undercity', 'gate')
    await shot(cdp, 'top-gate')
  },
  async fly(cdp) {
    await cdp.send('Page.navigate', { url: `${base}/under` })
    await sleep(4000)
    await drag(cdp, { x: 720, y: 450 }, { x: 1100, y: 300 }, 1500)
    await sleep(300)
    await shot(cdp, 'under-flying')
  },
  async grade(cdp) {
    for (const [path, name] of [['/under?fx=1', 'grade-under-t1'], ['/top?fx=2', 'grade-top-t2'], ['/top?fx=0', 'grade-top-off']]) {
      await cdp.send('Page.navigate', { url: `${base}${path}` })
      await sleep(4500)
      await shot(cdp, name)
    }
  },
  async splash(cdp) {
    await cdp.send('Page.navigate', { url: `${base}/?journey=0` })
    await sleep(3000)
    await click(cdp, '.journey-choice--top')
    await waitFor(cdp, `document.querySelector('.splash')?.dataset.phase === 'in'`, 15000)
    await shot(cdp, 'splash-mid')
    await sleep(2500)
    await shot(cdp, 'splash-after')
    console.log('  path after splash:', await evaluate(cdp, 'location.pathname'))
    await cdp.send('Page.navigate', { url: `${base}/blue` })
    await sleep(1500)
    console.log('  /blue redirects to:', await evaluate(cdp, 'location.pathname'))
  },
  async reduced(cdp) {
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    // the ride cuts from stop to stop and never moves on by itself
    await cdp.send('Page.navigate', { url: `${base}/?journey=1` })
    await sleep(3000)
    await click(cdp, '.journey-ignite')
    await sleep(2500)
    console.log('  reduced, after take-off:', await evaluate(cdp, 'JSON.stringify({ phase: window.__journey.current.phase, i: window.__journey.current.i })'))
    await sleep(6000)
    console.log('  reduced, 6 s later:', await evaluate(cdp, 'JSON.stringify({ phase: window.__journey.current.phase, i: window.__journey.current.i })'))
    await shot(cdp, 'reduced-home-stop')
    await cdp.send('Page.navigate', { url: `${base}/under` })
    await sleep(3500)
    await flyAndWait(cdp, 'delhi', 'delhi')
    await shot(cdp, 'reduced-under-delhi')
  },
  // the shooter: title, a few seconds of play in both views, then a boss wave
  async play(cdp) {
    const fps = () => evaluate(cdp, `new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r((n / 2).toFixed(1)) }; requestAnimationFrame(f) })`)
    const stats = () => evaluate(cdp, `(() => { const g = window.__impact?.game; return g && JSON.stringify({ score: g.score, hull: g.hull, wave: g.wave, kills: g.kills, live: g.creatures.filter((c) => c.on).length, boss: g.boss.on ? g.boss.hp : null }) })()`)
    await cdp.send('Page.navigate', { url: `${base}/play?fx=0` })
    await sleep(3500)
    await shot(cdp, 'play-title')
    await click(cdp, '.play__start')
    await sleep(300)
    await evaluate(cdp, 'window.__impact.game.input.fire = true')
    for (let i = 0; i < 12; i++) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720 + Math.sin(i) * 300, y: 420 + Math.cos(i * 0.7) * 160 })
      await sleep(450)
    }
    await shot(cdp, 'play-chase')
    console.log('  chase:', await stats(), 'fps', await fps())
    await evaluate(cdp, "window.__impact.useGame.getState().set({ cam: 'cockpit' })")
    await sleep(2500)
    await shot(cdp, 'play-cockpit')
    console.log('  cockpit:', await stats())
    await cdp.send('Page.navigate', { url: `${base}/play?wave=5&city=top&fx=0` })
    await sleep(3000)
    await click(cdp, '.play__start')
    await sleep(300)
    await evaluate(cdp, 'window.__impact.game.input.fire = true')
    await sleep(7000)
    await shot(cdp, 'play-boss')
    console.log('  boss:', await stats(), 'fps', await fps())
    await evaluate(cdp, 'window.__impact.game.hull = 1; window.__impact.game.player.inv = 0; window.__impact.game.input.fire = false')
    await sleep(9000)
    await shot(cdp, 'play-over')
    // a scoring run, so the end card shows the board saving it
    await cdp.send('Page.navigate', { url: `${base}/play?fx=0` })
    await sleep(2500)
    await shot(cdp, 'play-board-title')
    await click(cdp, '.play__start')
    await sleep(1500)
    await evaluate(cdp, "Object.assign(window.__impact.game, { score: 2250, kills: 9 }); window.__impact.useGame.getState().set({ phase: 'over', score: 2250 })")
    await sleep(3000)
    await shot(cdp, 'play-board-over')
    console.log('  board after:', await evaluate(cdp, "document.querySelector('.board__note')?.textContent"))
    console.log('  phase after:', await evaluate(cdp, 'window.__impact.useGame.getState().phase'))
  },
  async playmobile(cdp) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    await cdp.send('Page.navigate', { url: `${base}/play?fx=0` })
    await sleep(3000)
    await shot(cdp, 'm-play-title')
    await click(cdp, '.play__start')
    await sleep(300)
    await evaluate(cdp, 'window.__impact.game.input.fire = true')
    await sleep(5000)
    await shot(cdp, 'm-play')
    await cdp.send('Page.navigate', { url: `${base}/play?wave=5&fx=0` })
    await sleep(2500)
    await click(cdp, '.play__start')
    await sleep(9000)
    await shot(cdp, 'm-play-boss')
  },
  // aliases from before the cities were renamed
  async blue(cdp) {
    return scenarios.under(cdp)
  },
  async red(cdp) {
    return scenarios.top(cdp)
  },
  async debug(cdp) {
    await cdp.send('Page.navigate', { url: `${base}/under?fx=0` })
    await sleep(4500)
    await shot(cdp, 'dbg-nofx')
    const info = () => evaluate(cdp, `(() => { const c = document.querySelector('canvas'); const b = c.getBoundingClientRect(); return JSON.stringify({ inner: [innerWidth, innerHeight], canvas: [b.width, b.height, c.width, c.height], sim: (() => { const s = window.__deepfield?.sim; return s && { x: s.x, y: s.y, vx: s.vx, vy: s.vy, ...s.debug } })(), docked: window.__deepfield?.useStore.getState().docked }) })()`)
    console.log('  before:', await info())
    await click(cdp, '.flag[aria-label="fly to delhi"]')
    await sleep(5500)
    console.log('  docked:', await info())
    await shot(cdp, 'dbg-delhi-nofx')
  },
  async text(cdp) {
    await cdp.send('Page.navigate', { url: `${base}/text` })
    await sleep(1500)
    await shot(cdp, 'text')
  },
  async mobile(cdp) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    await cdp.send('Page.navigate', { url: `${base}/?journey=1` })
    await sleep(3000)
    await shot(cdp, 'm-home')
    await click(cdp, '.journey-ignite')
    await waitFor(cdp, `window.__journey.current.phase === 'dwell'`, 40000)
    await sleep(1600)
    await shot(cdp, 'm-home-stop')
    await cdp.send('Page.navigate', { url: `${base}/?journey=0` })
    await sleep(3000)
    await shot(cdp, 'm-home-fork')
    await cdp.send('Page.navigate', { url: `${base}/top` })
    await sleep(4500)
    await shot(cdp, 'm-top')
    await flyAndWait(cdp, 'unthinkable', 'unthinkable')
    await shot(cdp, 'm-top-story')
  },
  // the first card and the fork at the sizes the layout changes at: big desktop, short laptop, narrow desktop, phones
  async homesizes(cdp) {
    for (const [w, h] of [[1920, 1080], [1280, 720], [1024, 768], [390, 844], [375, 667]]) {
      const phone = w <= 720
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: phone ? 2 : 1, mobile: phone })
      await cdp.send('Page.navigate', { url: `${base}/?journey=1` })
      await waitFor(cdp, 'window.__journey?.current', 10000)
      await sleep(1500)
      await evaluate(cdp, 'window.__journey.current.tap = true; window.__journey.current.rush = true')
      await waitFor(cdp, `window.__journey.current.phase === 'dwell'`, 40000)
      await sleep(1500)
      await shot(cdp, `home-${w}x${h}-card`)
      await cdp.send('Page.navigate', { url: `${base}/?journey=0` })
      await sleep(3000)
      const m = await evaluate(
        cdp,
        `(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }; return JSON.stringify({ under: r('.journey-choice--under .journey-choice__title'), top: r('.journey-choice--top .journey-choice__title'), play: r('.journey-slab'), foot: r('.journey-fork__foot'), page: document.documentElement.scrollWidth }) })()`,
      )
      console.log(`  ${w}x${h} ${m}`)
      await shot(cdp, `home-${w}x${h}-fork`)
    }
  },
  // every stop's poster title, docked directly (no flight), on desktop and phone; logs any title wider than its column
  async posters(cdp) {
    for (const [w, h, tag] of [[1440, 900, 'd'], [390, 844, 'm']]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: tag === 'm' ? 2 : 1, mobile: tag === 'm' })
      for (const city of ['under', 'top']) {
        await cdp.send('Page.navigate', { url: `${base}/${city}?fx=0` })
        await waitFor(cdp, 'window.__deepfield?.useStore.getState().worldKey', 20000)
        await sleep(1500)
        const ids = await evaluate(cdp, 'window.__deepfield.world.stops.map((s) => s.id)')
        for (const [i, id] of ids.entries()) {
          // park the ship beside the stop first, or the sim undocks it on the next frame
          await evaluate(
            cdp,
            `(() => { const { sim, useStore, world } = window.__deepfield; const s = world.stops.find((s) => s.id === ${JSON.stringify(id)}); Object.assign(sim, { autopilot: null, leftId: null, x: s.pos[0], y: s.pos[1] - s.r - 4, vx: 0, vy: 0 }); const st = useStore.getState(); st.undock(); st.dock(s.id) })()`,
          )
          await sleep(1200)
          const m = await evaluate(
            cdp,
            `(() => { const t = document.querySelector('.poster__title'); const b = document.querySelector('.poster'); if (!t) return null; const g = document.createRange(); g.selectNodeContents(t); const r = g.getBoundingClientRect(); const s = document.querySelector('.story')?.getBoundingClientRect(); return { fs: parseFloat(t.style.fontSize), over: t.scrollWidth - t.clientWidth, ink: Math.round(r.right - t.getBoundingClientRect().right), h: Math.round(r.height), box: b.clientHeight, hitsPanel: s ? r.right > s.left && r.bottom > s.top && r.top < s.bottom : false } })()`,
          )
          console.log(`  ${tag} ${city} ${id}: ${JSON.stringify(m)}`)
          await shot(cdp, `poster-${tag}-${city}-${i}`)
        }
      }
    }
  },
}

await waitForChrome()
const names = only.length ? only : Object.keys(scenarios).filter((n) => n !== 'blue' && n !== 'red')
for (const name of names) {
  const cdp = await openTab()
  try {
    await scenarios[name](cdp)
  } catch (e) {
    console.log(`scenario ${name} failed: ${e.message}`)
  }
  const uniq = [...new Set(cdp.logs)]
  if (uniq.length) console.log(`  console (${name}):\n    ` + uniq.slice(0, 12).join('\n    '))
  await closeTab(cdp)
}
chrome.kill()
process.exit(0)
