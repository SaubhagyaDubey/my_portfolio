import * as THREE from 'three'

// One shared four-step light ramp for MeshToonMaterial: metal reads as painted planes of value.
let ramp = null

export function toonRamp() {
  if (ramp) return ramp
  const data = new Uint8Array([46, 46, 46, 255, 110, 110, 110, 255, 186, 186, 186, 255, 255, 255, 255, 255])
  ramp = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat)
  ramp.minFilter = THREE.NearestFilter
  ramp.magFilter = THREE.NearestFilter
  ramp.generateMipmaps = false
  ramp.needsUpdate = true
  return ramp
}

// FX animate on twos (8 fps steps); under reduced motion they run continuously and slowly instead.
export const fxStep = (reduced) => (reduced ? 0 : 8)
