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
  async home(cdp) {
    await cdp.send('Page.navigate', { url: `${base}/` })
    await sleep(3500)
    await shot(cdp, 'home')
    await hover(cdp, '.galaxy--under')
    await sleep(1600)
    await shot(cdp, 'home-hover-under')
    await hover(cdp, '.galaxy--top')
    await sleep(1600)
    await shot(cdp, 'home-hover-top')
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
    await cdp.send('Page.navigate', { url: `${base}/` })
    await sleep(3000)
    await click(cdp, '.galaxy--top')
    await sleep(1150)
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
    await cdp.send('Page.navigate', { url: `${base}/` })
    await sleep(3000)
    await shot(cdp, 'm-home')
    await cdp.send('Page.navigate', { url: `${base}/top` })
    await sleep(4500)
    await shot(cdp, 'm-top')
    await flyAndWait(cdp, 'unthinkable', 'unthinkable')
    await shot(cdp, 'm-top-story')
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
