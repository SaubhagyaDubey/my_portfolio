import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { CITIES } from '../data/palette.js'
import { getTier } from '../lib/tier.js'
import { GradeEffect } from './post/GradeEffect.js'
import { InkEffect } from './post/InkEffect.js'
import { LensEffect } from './post/LensEffect.js'

// After the scene renders, three passes. The frame stays clean: no brush, paper or grain over it.
//   1. Ink   - brushed outlines from depth + luminance (galaxies only, tier 1+)
//   2. Bloom + Grade - halation, ACES, per-city split tone, vignette
//   3. Lens  - edge chromatic aberration
// Every value that changes at runtime is written onto uniforms in useFrame; nothing here re-renders.
//
// city: 'under' | 'top' for a galaxy. air: the galaxy's live sky (air.js), which the city's split tone
// follows as you dock at planets. launch: the Launch state ref, whose `seam` blends both cities across the screen.
export default function Effects({ city = 'under', air = null, launch = null }) {
  const tier = getTier()
  const { camera, gl } = useThree()
  const c = CITIES[city]

  const ink = useMemo(
    () => (tier > 0 && !launch ? new InkEffect({ ink: c.inkTint, depthWeight: 2.2, lumaWeight: tier === 2 ? 0.9 : 0.7 }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tier, launch],
  )
  const grade = useMemo(
    () => new GradeEffect({ a: CITIES.under.grade, b: CITIES.top.grade, mix: city === 'top' ? 1 : 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const lens = useMemo(() => new LensEffect({ ca: tier === 0 ? 0 : 0.005 }), [tier])

  useEffect(
    () => () => {
      for (const e of [ink, grade, lens]) e?.dispose()
    },
    [ink, grade, lens],
  )

  const size = useMemo(() => new THREE.Vector2(), [])
  useFrame(() => {
    // keep the ink's wobble glued to the world as the camera pans (galaxies only)
    if (ink && camera.isPerspectiveCamera) {
      gl.getDrawingBufferSize(size)
      const fovH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z
      const ppu = size.y / fovH
      ink.uniforms.get('uCam').value.set(camera.position.x * ppu * 0.013, camera.position.y * ppu * 0.013)
    }
    if (air) {
      const slot = city === 'top' ? 'B' : 'A'
      grade.uniforms.get(`uShadow${slot}`).value.copy(air.shadow)
      grade.uniforms.get(`uMid${slot}`).value.copy(air.mid)
      grade.uniforms.get(`uHigh${slot}`).value.copy(air.high)
    }
    if (launch) {
      // the Director eases the seam; the grade follows it so both cities' light meets where the sky does
      const s = launch.current
      grade.uniforms.get('uSeam').value = s.seam ?? 0.5
      grade.uniforms.get('uSplit').value = 0.16
      grade.uniforms.get('uVertical').value = s.stacked ? 1 : 0
    }
  })

  return (
    <EffectComposer multisampling={tier === 0 ? 0 : 4}>
      {ink ? <primitive object={ink} dispose={null} /> : null}
      <Bloom
        mipmapBlur
        intensity={launch ? 1.1 : 0.9}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.4}
        radius={0.85}
        resolutionScale={tier === 0 ? 0.35 : 0.5}
      />
      <primitive object={grade} dispose={null} />
      <primitive object={lens} dispose={null} />
    </EffectComposer>
  )
}
