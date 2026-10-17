import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useShaderMaterial } from '../three/useShaderMaterial.js'
import { getTier } from '../lib/tier.js'
import { game } from './state.js'

const vert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vC;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(180.0, aSize * uScale / max(0.5, -mv.z));
  vC = aColor;
  vA = aAlpha;
}
`
const frag = /* glsl */ `
varying vec3 vC;
varying float vA;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  float a = pow(smoothstep(1.0, 0.0, r), 1.6) * vA;
  // hot white middle, coloured edge
  vec3 c = mix(vC, vec3(1.0, 0.96, 0.88), smoothstep(0.5, 0.0, r) * vA);
  gl_FragColor = vec4(c * a * 1.8, a);
}
`

const col = new THREE.Color()

// Pooled additive sparks. GameLoop queues bursts in game.bursts; this drains the queue each frame.
export default function Explosions() {
  const { gl, size, camera } = useThree()
  const N = getTier() === 0 ? 700 : 1400
  const parts = useMemo(() => Array.from({ length: N }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1 })), [N])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N), 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    return g
  }, [N])
  const uniforms = useMemo(() => ({ uScale: { value: 400 } }), [])
  const material = useShaderMaterial(vert, frag, uniforms, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const cursor = useMemo(() => ({ i: 0 }), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 15)
    uniforms.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
    const pos = geometry.attributes.position.array
    const cl = geometry.attributes.aColor.array
    const sz = geometry.attributes.aSize.array
    const al = geometry.attributes.aAlpha.array
    // spawn queued bursts into a ring buffer
    for (const b of game.bursts) {
      col.set(b.color)
      for (let k = 0; k < b.n; k++) {
        const i = cursor.i
        cursor.i = (cursor.i + 1) % N
        const p = parts[i]
        const u = Math.random() * 2 - 1
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(1 - u * u)
        const sp = b.speed * (0.25 + Math.random() * 0.75)
        p.x = b.x
        p.y = b.y
        p.z = b.z
        p.vx = r * Math.cos(a) * sp
        p.vy = r * Math.sin(a) * sp
        p.vz = u * sp
        p.max = 0.45 + Math.random() * 0.6
        p.life = p.max
        p.s = b.size * (0.5 + Math.random())
        cl[i * 3] = col.r
        cl[i * 3 + 1] = col.g
        cl[i * 3 + 2] = col.b
      }
    }
    game.bursts.length = 0
    const drag = Math.pow(0.12, dt)
    const flow = game.speed * 0.45 * dt
    for (let i = 0; i < N; i++) {
      const p = parts[i]
      if (p.life <= 0) {
        al[i] = 0
        continue
      }
      p.life -= dt
      p.vx *= drag
      p.vy *= drag
      p.vz *= drag
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt + flow
      pos[i * 3] = p.x
      pos[i * 3 + 1] = p.y
      pos[i * 3 + 2] = p.z
      const k = Math.max(0, p.life / p.max)
      al[i] = k
      sz[i] = p.s * (0.6 + k * 0.6)
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aColor.needsUpdate = true
    geometry.attributes.aSize.needsUpdate = true
    geometry.attributes.aAlpha.needsUpdate = true
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />
}
