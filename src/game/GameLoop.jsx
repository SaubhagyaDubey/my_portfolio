import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SHIP_EYE, SHIP_MUZZLES } from '../three/ShipModel.jsx'
import { BOSS, SPECIES } from './creatures.js'
import { AIM_Z, BOSS_SEGMENTS, BOX, HULL_MAX, PASS_Z, RAIL, ROLL_TIME, SEG_GAP, SHIP_S, SPAWN_Z, burst, firstFree, game, saveBest, segmentPos, useGame } from './state.js'
import { BETWEEN_WAVES, BOSS_CALL, BOSS_COMBO, BOSS_DYING, FIRE_CD, SPLITTER_CHILDREN, TWIN_FIRE_CD, bossHp, multiplier } from './rules.js'
import { BOSS_EVERY, buildWave, waveLabel } from './waves.js'

const PLAYER_R = 1.0
const SHOT_SPEED = 250
const ORB_SPEED = 30
const ROLL_CD = 1.1
const DROP = 0.07
const KEY_SPEED = 26
const HOLD_Z = -72
const BOSS_Z = -68
const TRAIL_STEP = 0.045 // seconds between boss path samples

const look = new THREE.Vector3()

// One frame of the whole game: input, ship, waves, creatures, shots, hits, camera. Nothing here re-renders.
export default function GameLoop({ city }) {
  const { camera } = useThree()

  useEffect(() => {
    camera.near = 0.05
    camera.far = 4000
    camera.updateProjectionMatrix()
  }, [camera])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 15)
    const hud = useGame.getState()
    const p = game.player
    if (hud.phase === 'paused') return
    game.boost += ((p.rollT > 0 ? 1 : 0) - game.boost) * Math.min(1, dt * 6)
    game.speed = RAIL * (game.reduced ? 0.75 : 1) * (1 + game.boost * 0.6)

    if (hud.phase === 'playing') step(dt, city)
    else if (hud.phase === 'title') idle(state.clock.elapsedTime, dt)
    updateCamera(camera, dt, hud.cam)
    if (hud.phase === 'playing') syncHud(hud)
  }, -1) // before anything draws, so every mesh sees this frame's state

  return null
}

// ---------------------------------------------------------------- title screen: the ship idles in the lane
function idle(t, dt) {
  const p = game.player
  const x = Math.sin(t * 0.5) * 2.6
  const y = Math.sin(t * 0.8) * 1.0 - 0.4
  p.vx = (x - p.x) / Math.max(dt, 1e-3)
  p.vy = (y - p.y) / Math.max(dt, 1e-3)
  p.x = x
  p.y = y
  p.bank += (THREE.MathUtils.clamp(-p.vx * 0.05, -0.8, 0.8) - p.bank) * Math.min(1, dt * 5)
  p.pitch = THREE.MathUtils.clamp(p.vy * 0.03, -0.3, 0.3)
}

// ---------------------------------------------------------------- the game proper
function step(dt, city) {
  const p = game.player
  const inp = game.input
  game.t += dt
  game.waveT += dt

  // ---- input → target point → spring the ship toward it
  let kx = 0
  let ky = 0
  const k = inp.keys
  if (k.has('ArrowLeft') || k.has('a') || k.has('A')) kx -= 1
  if (k.has('ArrowRight') || k.has('d') || k.has('D')) kx += 1
  if (k.has('ArrowUp') || k.has('w') || k.has('W')) ky += 1
  if (k.has('ArrowDown') || k.has('s') || k.has('S')) ky -= 1
  inp.tx = THREE.MathUtils.clamp(inp.tx + kx * KEY_SPEED * dt, -BOX.x, BOX.x)
  inp.ty = THREE.MathUtils.clamp(inp.ty + ky * KEY_SPEED * dt, -BOX.y, BOX.y)
  if (inp.roll) {
    inp.roll = false
    if (p.rollCd <= 0 && p.alive) {
      p.rollT = ROLL_TIME
      p.rollCd = ROLL_CD
      p.rollDir = Math.sign(p.vx || inp.tx - p.x) || 1
    }
  }
  if (p.alive) {
    const kS = 46
    const c = 12.5
    p.vx += ((inp.tx - p.x) * kS - p.vx * c) * dt
    p.vy += ((inp.ty - p.y) * kS - p.vy * c) * dt
    p.x = THREE.MathUtils.clamp(p.x + p.vx * dt, -BOX.x, BOX.x)
    p.y = THREE.MathUtils.clamp(p.y + p.vy * dt, -BOX.y, BOX.y)
  }
  p.bank += (THREE.MathUtils.clamp(-p.vx * 0.05, -0.85, 0.85) - p.bank) * Math.min(1, dt * 8)
  p.pitch += (THREE.MathUtils.clamp(p.vy * 0.035, -0.35, 0.35) - p.pitch) * Math.min(1, dt * 8)
  p.rollT = Math.max(0, p.rollT - dt)
  p.rollCd -= dt
  p.inv -= dt
  p.twin -= dt

  // ---- cannons
  p.fireCd -= dt
  if (inp.fire && p.alive && p.fireCd <= 0) fire(p)

  // ---- waves (frozen while the ship explodes, so the wave you died in is the wave reported)
  if (p.alive) {
    if (game.between > 0) {
      game.between -= dt
      if (game.between <= 0) startWave(game.wave + 1)
    } else {
      while (game.queue.length && game.queue[0].t <= game.waveT) spawn(game.queue.shift())
      if (!game.queue.length && !game.boss.on && !game.creatures.some((c) => c.on)) {
        game.between = BETWEEN_WAVES
        announce(`wave ${game.wave} clear`, game.wave % BOSS_EVERY === 0 ? 'the lane is quiet for a second' : 'next one is coming')
      }
    }
  }
  if (game.bannerT > 0) {
    game.bannerT -= dt
    if (game.bannerT <= 0) useGame.getState().set({ banner: null })
  }

  updateCreatures(dt, city)
  updateBoss(dt, city)
  updateShots(dt, city)
  updateOrbs(dt, city)
  updatePickups(dt, city)

  game.comboT -= dt
  if (game.comboT <= 0) game.combo = 0
  game.shake = Math.max(0, game.shake - dt * 2.2)

  // ---- dying: let the explosion play, then the end card
  if (!p.alive) {
    game.overT -= dt
    if (game.overT <= 0) {
      const st = useGame.getState()
      const best = Math.max(st.best, game.score)
      if (best > st.best) saveBest(best)
      st.set({ phase: 'over', best, score: game.score, boss: null, banner: null })
    }
  }
}

function announce(text, sub) {
  game.bannerT = 2.6
  useGame.getState().set({ banner: { text, sub, key: `${text}-${game.t.toFixed(2)}` } })
}

function startWave(n) {
  game.wave = n
  game.waveT = 0
  game.queue = buildWave(n)
  const l = waveLabel(n)
  announce(l.text, l.sub)
}

// model space (nose +x, up +z) → game space (nose -z, up +y), rolled by the ship's bank
function toWorld(m, roll, out) {
  const x = -m[1] * SHIP_S
  const y = m[2] * SHIP_S
  const c = Math.cos(roll)
  const s = Math.sin(roll)
  out.x = game.player.x + x * c - y * s
  out.y = game.player.y + x * s + y * c
  out.z = -m[0] * SHIP_S
  return out
}

const mz = { x: 0, y: 0, z: 0 }
function fire(p) {
  const which = p.twin > 0 ? [0, 1] : [p.muzzle]
  p.muzzle ^= 1
  for (const i of which) {
    const s = firstFree(game.shots)
    if (!s) return
    toWorld(SHIP_MUZZLES[i], p.bank, mz)
    const dx = p.x - mz.x
    const dy = p.y - mz.y
    const dz = AIM_Z - mz.z
    const l = Math.hypot(dx, dy, dz)
    Object.assign(s, { on: true, x: mz.x, y: mz.y, z: mz.z, vx: (dx / l) * SHOT_SPEED, vy: (dy / l) * SHOT_SPEED, vz: (dz / l) * SHOT_SPEED, life: 1.5 })
  }
  p.fireCd = p.twin > 0 ? TWIN_FIRE_CD : FIRE_CD
}

function spawn(ev) {
  if (ev.kind === 'boss') return spawnBoss()
  const c = firstFree(game.creatures)
  if (!c) return
  const sp = SPECIES[ev.kind]
  const level = game.wave - Math.floor(game.wave / BOSS_EVERY)
  Object.assign(c, {
    on: true,
    kind: ev.kind,
    x: ev.x,
    y: ev.y,
    z: SPAWN_Z - Math.random() * 20,
    bx: ev.x,
    by: ev.y,
    vx: ev.vx ?? 0,
    vy: ev.vy ?? 0,
    vz: 0,
    hp: sp.hp + (sp.hp > 1 ? Math.floor(level / 4) : 0),
    r: sp.r,
    t: 0,
    phase: ev.phase,
    pattern: ev.pattern,
    flash: 0,
    fireCd: 0.8 + Math.random(),
    hold: 0,
  })
  if (ev.z !== undefined) c.z = ev.z
}

function spawnBoss() {
  const b = game.boss
  const hp = bossHp(game.wave)
  Object.assign(b, { on: true, x: 0, y: 0, z: -460, hp, max: hp, t: 0, fireCd: 3, callCd: BOSS_CALL.first, flash: 0, dying: 0, trailT: 0 })
  b.trail.length = 0
  for (let i = 0; i < BOSS_SEGMENTS * SEG_GAP + 2; i++) b.trail.push({ x: 0, y: 0, z: -460 })
  announce('leviathan', 'shoot the head. the body just soaks it up.')
}

function fireOrb(x, y, z, tx, ty) {
  const o = firstFree(game.orbs)
  if (!o) return
  const dx = tx - x
  const dy = ty - y
  const dz = 0 - z
  const l = Math.hypot(dx, dy, dz) || 1
  Object.assign(o, { on: true, x, y, z, vx: (dx / l) * ORB_SPEED, vy: (dy / l) * ORB_SPEED, vz: (dz / l) * ORB_SPEED + game.speed * 0.3, life: 6 })
}

// ---------------------------------------------------------------- creatures
function updateCreatures(dt, city) {
  const p = game.player
  const sp = game.speed
  for (const c of game.creatures) {
    if (!c.on) continue
    c.t += dt
    c.flash = Math.max(0, c.flash - dt * 7)
    const t = c.t
    switch (c.pattern) {
      case 'sway':
        c.z += sp * 0.72 * dt
        c.x = c.bx + Math.sin(t * 1.1 + c.phase) * 2.4
        c.y = c.by + Math.sin(t * 0.8 + c.phase * 1.7) * 1.4
        break
      case 'helix': {
        c.z += sp * 1.25 * dt
        const a = t * 2.4 + c.phase
        c.x = c.bx + Math.cos(a) * 4.5
        c.y = c.by + Math.sin(a) * 3.2
        break
      }
      case 'burst':
        c.bx += c.vx * dt
        c.by += c.vy * dt
        c.vx *= Math.pow(0.15, dt)
        c.vy *= Math.pow(0.15, dt)
        c.z += sp * (t < 0.6 ? 0.4 : 1.3) * dt
        if (t > 0.6) {
          c.bx += (p.x - c.bx) * 0.5 * dt
          c.by += (p.y - c.by) * 0.5 * dt
        }
        c.x = c.bx
        c.y = c.by
        break
      case 'v':
        c.z += sp * 1.35 * dt
        c.bx += (p.x - c.bx) * 0.3 * dt
        c.by += (p.y - c.by) * 0.3 * dt
        c.x = c.bx
        c.y = c.by
        break
      case 'hold':
        if (c.hold === 0) {
          c.z += sp * 0.95 * dt
          if (c.z >= HOLD_Z) c.hold = 1e-6
        } else if (c.hold < 6.5) {
          c.hold += dt
          c.z += (HOLD_Z - c.z) * Math.min(1, dt * 3)
          c.bx += (p.x * 0.6 - c.bx) * 0.45 * dt
          c.by += (p.y * 0.6 - c.by) * 0.45 * dt
          c.fireCd -= dt
          if (c.fireCd <= 0 && p.alive) {
            c.fireCd = Math.max(0.9, 1.6 - game.wave * 0.04)
            fireOrb(c.x, c.y, c.z + 1.5, p.x, p.y)
          }
        } else {
          c.z += sp * 1.5 * dt
        }
        c.x = c.bx + Math.sin(t * 1.3 + c.phase) * 1.2
        c.y = c.by + Math.cos(t * 1.1 + c.phase) * 0.8
        break
      default: // tumble
        c.z += sp * 0.6 * dt
        c.x = c.bx + Math.sin(t * 0.6 + c.phase) * 3
        c.y = c.by + Math.cos(t * 0.5 + c.phase) * 2
    }
    if (c.z > PASS_Z) {
      c.on = false
      continue
    }
    // body hits the ship
    if (p.alive && Math.abs(c.z) < c.r + PLAYER_R && Math.hypot(c.x - p.x, c.y - p.y) < c.r + PLAYER_R) {
      if (hitPlayer(city)) {
        c.on = false
        burst(c.x, c.y, c.z, enemyGlow(c.kind, city), 30, 14)
      }
    }
  }
}

function enemyGlow(kind, city) {
  const core = SPECIES[kind]?.core ?? 'enemy'
  return core === 'enemy' ? city.accent2 : core
}

function kill(c, city) {
  const sp = SPECIES[c.kind]
  c.on = false
  game.combo += 1
  game.comboT = 2.6
  game.kills += 1
  game.score += sp.score * multiplier(game.combo)
  burst(c.x, c.y, c.z, enemyGlow(c.kind, city), c.kind === 'splitter' ? 46 : 30, c.kind === 'splitter' ? 20 : 14, c.kind === 'splitter' ? 1.6 : 1.2)
  if (c.kind === 'splitter') {
    for (let i = 0; i < SPLITTER_CHILDREN; i++) {
      const a = (i / SPLITTER_CHILDREN) * Math.PI * 2 + Math.random()
      spawn({ kind: 'dart', x: c.x, y: c.y, z: c.z, vx: Math.cos(a) * 14, vy: Math.sin(a) * 10, pattern: 'burst', phase: 0 })
    }
  }
  if (Math.random() < DROP) {
    const pk = firstFree(game.pickups)
    if (pk) Object.assign(pk, { on: true, kind: game.hull < HULL_MAX && Math.random() < 0.55 ? 'repair' : 'twin', x: c.x, y: c.y, z: c.z, t: 0 })
  }
}

// ---------------------------------------------------------------- boss
function updateBoss(dt, city) {
  const b = game.boss
  if (!b.on) return
  const p = game.player
  b.t += dt
  b.flash = Math.max(0, b.flash - dt * 6)
  b.z += (BOSS_Z - b.z) * Math.min(1, dt * 0.9)
  b.x = Math.sin(b.t * 0.45) * 9
  b.y = Math.sin(b.t * 0.7) * 3.6 + 0.6
  b.trailT += dt
  while (b.trailT >= TRAIL_STEP) {
    b.trailT -= TRAIL_STEP
    b.trail.push({ x: b.x, y: b.y, z: b.z })
    if (b.trail.length > BOSS_SEGMENTS * SEG_GAP + 2) b.trail.shift()
  }
  if (b.dying > 0) {
    b.dying -= dt
    if (Math.random() < dt * 14) {
      const s = segmentPos(Math.floor(Math.random() * BOSS_SEGMENTS))
      burst(s.x + (Math.random() - 0.5) * 3, s.y + (Math.random() - 0.5) * 3, s.z, Math.random() < 0.5 ? city.accent2 : '#fff3dc', 34, 18, 1.8)
    }
    if (b.dying <= 0) {
      b.on = false
      burst(b.x, b.y, b.z, '#fff3dc', 80, 30, 2.4)
      useGame.getState().set({ boss: null })
    }
    return
  }
  if (b.z > BOSS_Z - 30 && p.alive) {
    b.fireCd -= dt
    if (b.fireCd <= 0) {
      const cycle = Math.max(1, Math.round(game.wave / BOSS_EVERY))
      b.fireCd = Math.max(1.0, 2.2 - cycle * 0.25)
      for (let k = -3; k <= 3; k++) fireOrb(b.x, b.y - 1, b.z + 4, p.x + k * 3.2, p.y + (k % 2) * 1.6)
    }
    b.callCd -= dt
    if (b.callCd <= 0) {
      b.callCd = BOSS_CALL.every
      for (let i = 0; i < BOSS_CALL.darts; i++) spawn({ kind: 'dart', x: b.x, y: b.y, z: b.z + 3, vx: (i - 1.5) * 9, vy: (i % 2 ? 1 : -1) * 6, pattern: 'burst', phase: 0 })
    }
  }
}

function damageBoss(city) {
  const b = game.boss
  b.hp -= 1
  b.flash = 1
  if (b.hp <= 0 && b.dying <= 0) {
    b.dying = BOSS_DYING
    game.combo += BOSS_COMBO
    game.comboT = 4
    game.score += BOSS.score * multiplier(game.combo)
    for (const o of game.orbs) o.on = false // the lane clears when it goes down
    burst(b.x, b.y, b.z, city.accent2, 60, 26, 2)
  }
  useGame.getState().set({ boss: Math.max(0, b.hp / b.max) })
}

// ---------------------------------------------------------------- shots, orbs, pickups
function updateShots(dt, city) {
  const b = game.boss
  for (const s of game.shots) {
    if (!s.on) continue
    const pz = s.z
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.z += s.vz * dt
    s.life -= dt
    if (s.life <= 0 || s.z < SPAWN_Z - 60) {
      s.on = false
      continue
    }
    // swept along z: the shot covers ~4 units a frame
    for (const c of game.creatures) {
      if (!c.on || c.z < s.z - c.r || c.z > pz + c.r) continue
      if (Math.hypot(c.x - s.x, c.y - s.y) > c.r + 0.35) continue
      s.on = false
      c.hp -= 1
      c.flash = 1
      if (c.hp <= 0) kill(c, city)
      else burst(s.x, s.y, c.z + c.r, '#fff3dc', 6, 6, 0.6)
      break
    }
    if (!s.on || !b.on || b.dying > 0) continue
    if (b.z >= s.z - BOSS.r && b.z <= pz + BOSS.r && Math.hypot(b.x - s.x, b.y - s.y) < BOSS.r + 0.4) {
      s.on = false
      damageBoss(city)
      burst(s.x, s.y, b.z + BOSS.r, city.accent2, 5, 7, 0.7)
      continue
    }
    for (let i = 0; i < BOSS_SEGMENTS; i++) {
      const sg = segmentPos(i)
      if (sg.z < s.z - BOSS.segR || sg.z > pz + BOSS.segR) continue
      if (Math.hypot(sg.x - s.x, sg.y - s.y) > BOSS.segR * (1 - i * 0.025) + 0.3) continue
      s.on = false
      burst(s.x, s.y, sg.z + BOSS.segR, '#a89a8a', 4, 5, 0.5)
      break
    }
  }
}

function updateOrbs(dt, city) {
  const p = game.player
  for (const o of game.orbs) {
    if (!o.on) continue
    o.x += o.vx * dt
    o.y += o.vy * dt
    o.z += o.vz * dt
    o.life -= dt
    if (o.life <= 0 || o.z > PASS_Z) {
      o.on = false
      continue
    }
    if (p.alive && Math.abs(o.z) < 1.2 && Math.hypot(o.x - p.x, o.y - p.y) < PLAYER_R + 0.45) {
      if (hitPlayer(city)) o.on = false
    }
  }
}

function updatePickups(dt, city) {
  const p = game.player
  for (const k of game.pickups) {
    if (!k.on) continue
    k.t += dt
    k.z += game.speed * 0.8 * dt
    // drift toward the ship once it is close, so near misses still count
    if (k.z > -20) {
      k.x += (p.x - k.x) * dt * 1.5
      k.y += (p.y - k.y) * dt * 1.5
    }
    if (k.z > PASS_Z) {
      k.on = false
      continue
    }
    if (p.alive && Math.abs(k.z) < 2 && Math.hypot(k.x - p.x, k.y - p.y) < 2.8) {
      k.on = false
      if (k.kind === 'repair') {
        game.hull = Math.min(HULL_MAX, game.hull + 1)
        burst(p.x, p.y, 0, '#5cff8a', 24, 8, 0.9)
      } else {
        p.twin = 10
        burst(p.x, p.y, 0, city.glow, 24, 8, 0.9)
      }
    }
  }
}

function hitPlayer(city) {
  const p = game.player
  if (!p.alive || p.inv > 0 || p.rollT > 0) return false
  game.hull -= 1
  p.inv = 1.4
  game.shake = game.reduced ? 0 : 1
  game.combo = 0
  burst(p.x, p.y, 0, '#ff5a4d', 30, 12, 1)
  const st = useGame.getState()
  st.set({ hit: st.hit + 1 })
  if (game.hull <= 0) {
    p.alive = false
    game.overT = 1.6
    burst(p.x, p.y, 0, city.glow, 90, 24, 2.2)
    burst(p.x, p.y, 0, '#fff3dc', 50, 12, 1.6)
  }
  return true
}

// ---------------------------------------------------------------- camera
const eye = { x: 0, y: 0, z: 0 }
function updateCamera(camera, dt, mode) {
  const p = game.player
  let fov
  if (mode === 'cockpit') {
    toWorld(SHIP_EYE, p.bank, eye)
    camera.position.set(eye.x, eye.y, eye.z)
    look.set(eye.x, eye.y + p.pitch * 6, eye.z - 60)
    camera.lookAt(look)
    camera.rotateZ(p.bank)
    fov = 74 + game.boost * 10
  } else {
    // narrow (portrait) screens pull back and follow closer, so the whole lane still fits
    const back = Math.max(1, 1.02 / camera.aspect)
    const follow = back > 1 ? 0.86 : 0.72
    const tx = p.x * follow
    const ty = p.y * follow + 2.2 + (back - 1) * 1.6
    const tz = (9.6 - game.boost * 1.6) * back
    const f = Math.min(1, dt * 7)
    camera.position.x += (tx - camera.position.x) * f
    camera.position.y += (ty - camera.position.y) * f
    camera.position.z += (tz - camera.position.z) * f
    look.set(p.x * follow * 0.83, p.y * follow * 0.83 + 0.9, -40)
    camera.lookAt(look)
    if (!game.reduced) camera.rotateZ(p.bank * 0.2)
    fov = 60 + game.boost * 12
  }
  if (game.shake > 0) {
    const s = game.shake * game.shake
    camera.position.x += (Math.random() - 0.5) * s * 0.9
    camera.position.y += (Math.random() - 0.5) * s * 0.9
  }
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 8)
    camera.updateProjectionMatrix()
  }
}

// ---------------------------------------------------------------- HUD
function syncHud(hud) {
  const mult = multiplier(game.combo)
  const twin = game.player.twin > 0
  const patch = {}
  if (hud.score !== game.score) patch.score = game.score
  if (hud.hull !== game.hull) patch.hull = game.hull
  if (hud.wave !== game.wave && game.wave > 0) patch.wave = game.wave
  if (hud.mult !== mult) patch.mult = mult
  if (hud.twin !== twin) patch.twin = twin
  if (Object.keys(patch).length) hud.set(patch)
}
