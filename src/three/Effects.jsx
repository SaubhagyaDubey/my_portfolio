import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { CITIES } from '../data/palette.js'
import { getTier } from '../lib/tier.js'
import { GradeEffect } from './post/GradeEffect.js'
import { InkEffect } from './post/InkEffect.js'
import { LensEffect } from './post/LensEffect.js'
import { PaintEffect } from './post/PaintEffect.js'

// The painted look, as four passes after the scene renders:
//   1. Paint  - Kuwahara brush (tier 2: 5x5, tier 1: 3x3, tier 0: off)
//   2. Ink    - brushed outlines from depth + luminance (off on the launch card and tier 0)
//   3. Bloom + Grade - halation, ACES, per-city split tone, paper, halftone, vignette
//   4. Lens   - edge chromatic aberration + grain on twos
// Every value that changes at runtime is written onto uniforms in useFrame; nothing here re-renders.
//
// city: 'under' | 'top' for a galaxy. launch: the Launch state ref (hover/warp), which blends both
// cities across the screen.
export default function Effects({ city = 'under', launch = null, reduced = false }) {
  const tier = getTier()
  const { camera, gl } = useThree()
  const c = CITIES[city]

  const paint = useMemo(
    () => (tier > 0 ? new PaintEffect({ radius: tier === 2 && !launch ? 2 : 1, step: tier === 2 ? 1.6 : 1.4 }) : null),
    [tier, launch],
  )
  const ink = useMemo(
    () => (tier > 0 && !launch ? new InkEffect({ ink: c.inkTint, depthWeight: 2.2, lumaWeight: tier === 2 ? 0.9 : 0.7 }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tier, launch],
  )
  const grade = useMemo(
    () =>
      new GradeEffect({
        a: CITIES.under.grade,
        b: CITIES.top.grade,
        mix: city === 'top' ? 1 : 0,
        halftone: tier === 0 ? 0 : 0.1,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const lens = useMemo(() => new LensEffect({ ca: tier === 0 ? 0 : 0.005, grain: 0.03 }), [tier])

  useEffect(() => {
    lens.frozen = reduced
  }, [lens, reduced])

  useEffect(
    () => () => {
      for (const e of [paint, ink, grade, lens]) e?.dispose()
    },
    [paint, ink, grade, lens],
  )

  const size = useMemo(() => new THREE.Vector2(), [])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    // keep the brush field glued to the world as the camera pans (galaxies only; launch is static)
    if (!launch && camera.isPerspectiveCamera) {
      gl.getDrawingBufferSize(size)
      const fovH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z
      const ppu = size.y / fovH
      const cam = paint?.uniforms.get('uCam').value
      if (cam) cam.set(camera.position.x * ppu * 0.013, camera.position.y * ppu * 0.013)
      ink?.uniforms.get('uCam').value.set(camera.position.x * ppu * 0.013, camera.position.y * ppu * 0.013)
    }
    if (launch) {
      // hovered city bleeds across the seam; warping floods the whole frame
      const s = launch.current
      const key = s.warp ?? s.hover
      const want = key === 'under' ? (s.warp ? 1.4 : 0.78) : key === 'top' ? (s.warp ? -0.4 : 0.22) : 0.5
      const seam = grade.uniforms.get('uSeam')
      seam.value += (want - seam.value) * Math.min(1, dt * (s.reduced ? 60 : 3.5))
      grade.uniforms.get('uSplit').value = 0.16
      grade.uniforms.get('uVertical').value = s.stacked ? 1 : 0
    }
  })

  return (
    <EffectComposer multisampling={tier === 0 ? 0 : 4}>
      {paint ? <primitive object={paint} dispose={null} /> : null}
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
