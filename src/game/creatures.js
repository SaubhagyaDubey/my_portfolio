import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SCORES } from './rules.js'

// The things out here. Each species is a toon-shaded body plus a glowing core that shares its transform.
// Bodies face the player (+z). Sizes are in world units; `r` is the hit radius.

function clean(g) {
  // mergeGeometries wants matching attributes; keep position + normal only
  const out = g.index ? g.toNonIndexed() : g
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k)
  return out
}

function merge(parts) {
  const g = mergeGeometries(parts.map(clean))
  g.computeBoundingSphere()
  return g
}

function jellyBody() {
  const bell = new THREE.SphereGeometry(1.2, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)
  bell.scale(1, 0.8, 1)
  const rim = new THREE.TorusGeometry(1.08, 0.12, 6, 22)
  rim.rotateX(Math.PI / 2)
  rim.translate(0, 0.05, 0)
  const parts = [bell, rim]
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    const len = 1.4 + (i % 3) * 0.45
    const t = new THREE.CylinderGeometry(0.07, 0.02, len, 5)
    t.translate(0, -len / 2, 0)
    t.rotateZ(Math.sin(a * 3) * 0.18)
    t.translate(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75)
    parts.push(t)
  }
  return merge(parts)
}

function dartBody() {
  const hull = new THREE.ConeGeometry(0.55, 2.4, 4)
  hull.rotateX(Math.PI / 2) // tip toward +z
  hull.rotateZ(Math.PI / 4)
  hull.scale(1, 0.55, 1)
  const fins = []
  for (const s of [-1, 1]) {
    const f = new THREE.BoxGeometry(1.5, 0.06, 0.7)
    f.rotateY(s * 0.5)
    f.translate(s * 0.7, 0, -0.55)
    fins.push(f)
  }
  const tail = new THREE.ConeGeometry(0.22, 0.9, 4)
  tail.rotateX(-Math.PI / 2)
  tail.translate(0, 0.22, -1.2)
  return merge([hull, ...fins, tail])
}

function spitterBody() {
  const core = new THREE.IcosahedronGeometry(1.15, 0)
  const parts = [core]
  const pos = new THREE.IcosahedronGeometry(1.15, 0).getAttribute('position')
  const seen = new Set()
  const v = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    const spike = new THREE.ConeGeometry(0.22, 1.1, 5)
    spike.translate(0, 0.55, 0)
    spike.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, v.clone().normalize()))
    spike.translate(v.x * 0.92, v.y * 0.92, v.z * 0.92)
    parts.push(spike)
  }
  return merge(parts)
}

function splitterBody() {
  const shell = new THREE.DodecahedronGeometry(1.7, 0)
  const parts = [shell]
  // three armour bands
  for (let i = 0; i < 3; i++) {
    const band = new THREE.TorusGeometry(1.62, 0.16, 5, 14)
    band.rotateX((i * Math.PI) / 3)
    band.rotateY((i * Math.PI) / 2.3)
    parts.push(band)
  }
  return merge(parts)
}

function bossHead() {
  const skull = new THREE.DodecahedronGeometry(3.1, 1)
  skull.scale(1.15, 0.85, 1.25)
  const parts = [skull]
  for (const s of [-1, 1]) {
    const jaw = new THREE.ConeGeometry(0.55, 3.6, 6)
    jaw.rotateX(Math.PI / 2)
    jaw.rotateY(-s * 0.35)
    jaw.translate(s * 1.9, -1.0, 3.2)
    parts.push(jaw)
    const horn = new THREE.ConeGeometry(0.4, 2.8, 6)
    horn.rotateZ(-s * 0.7)
    horn.rotateX(-0.5)
    horn.translate(s * 2.3, 2.4, -0.6)
    parts.push(horn)
  }
  const crest = new THREE.ConeGeometry(0.5, 2.4, 5)
  crest.rotateX(-0.9)
  crest.translate(0, 3.0, -1.4)
  parts.push(crest)
  return merge(parts)
}

function bossSegment() {
  const ring = new THREE.IcosahedronGeometry(2.1, 0)
  ring.scale(1, 0.9, 0.8)
  const parts = [ring]
  for (const s of [-1, 1]) {
    const spike = new THREE.ConeGeometry(0.35, 2.2, 5)
    spike.rotateZ(-s * Math.PI * 0.5)
    spike.translate(s * 2.6, 0, 0)
    parts.push(spike)
  }
  const fin = new THREE.ConeGeometry(0.4, 1.8, 4)
  fin.translate(0, 2.4, 0)
  parts.push(fin)
  return merge(parts)
}

// colour: toon body; core: which palette light the core glows in ('enemy' = city accent2, or a hex)
export const SPECIES = {
  jelly: { hp: 1, r: 1.5, score: SCORES.jelly, color: '#b7a2d6', core: 'enemy', coreR: 0.55, coreY: 0.25, max: 60, build: jellyBody },
  dart: { hp: 1, r: 1.1, score: SCORES.dart, color: '#3a3440', core: '#ff5a4d', coreR: 0.32, coreY: 0, max: 70, build: dartBody },
  spitter: { hp: 3, r: 1.9, score: SCORES.spitter, color: '#7a3b4a', core: 'enemy', coreR: 0.8, coreY: 0, max: 20, build: spitterBody },
  splitter: { hp: 5, r: 2.1, score: SCORES.splitter, color: '#5d6b4c', core: '#ffd36b', coreR: 0.9, coreY: 0, max: 16, build: splitterBody },
}

// scale applies to the whole beast; r and segR are already scaled hit radii
export const BOSS = { scale: 1.6, r: 5.6, segR: 3.8, gap: 4.8, score: SCORES.boss, color: '#5a3a52', build: bossHead, segment: bossSegment }
