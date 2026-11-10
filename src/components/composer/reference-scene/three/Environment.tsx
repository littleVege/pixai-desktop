import { useMemo } from 'react'
import { BackSide, Color, ShaderMaterial } from 'three'

export const SKY_TOP = '#eef0f3'
export const SKY_HORIZON = '#dfe2e7'
export const GROUND = '#c9ccd2'

const skyMaterial = () =>
  new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new Color(SKY_TOP) }, horizon: { value: new Color(SKY_HORIZON) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top;
uniform vec3 horizon;
varying vec3 vDir;
void main() {
  float t = pow(clamp(vDir.y, 0.0, 1.0), 0.6);
  gl_FragColor = vec4(mix(horizon, top, t), 1.0);
  #include <colorspace_fragment>
}`,
  })

/** Fixed lighting: a key light from the upper front plus soft ambient. */
export function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#9a9ca3', 1.6]} />
      <directionalLight
        position={[3, 7, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
    </>
  )
}

/** What the Render Camera sees around the Figures: a light grey ground fading into a gradient sky. */
export function RenderEnvironment() {
  const sky = useMemo(skyMaterial, [])
  return (
    <>
      <fog attach="fog" args={[SKY_HORIZON, 25, 220]} />
      <mesh material={sky} frustumCulled={false} renderOrder={-1}><sphereGeometry args={[400, 32, 16]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[300, 64]} /><meshStandardMaterial color={GROUND} roughness={1} /></mesh>
    </>
  )
}
