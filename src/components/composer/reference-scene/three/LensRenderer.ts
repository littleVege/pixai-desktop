import {
  CubeCamera, HalfFloatType, LinearFilter, Matrix3, Matrix4, Mesh, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Quaternion,
  Scene, ShaderMaterial, Vector2, Vector3, WebGLCubeRenderTarget, WebGLRenderTarget, type Object3D, type WebGLRenderer,
} from 'three'
import type { Lens } from '@/lib/reference-scene/lens.ts'
import type { RenderCamera } from '@/lib/reference-scene/types.ts'
import { cameraQuaternion } from '@/lib/reference-scene/camera.ts'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

/**
 * Each output pixel → image-plane position (mm) → angle from the optical axis through the lens model
 * ρ = f·tan(κθ)/κ → a view ray, which samples either a wide perspective render or a cube map.
 */
const fragmentShader = /* glsl */ `
uniform sampler2D tSrc;
uniform samplerCube tCube;
uniform bool useCube;
uniform vec2 sensor;
uniform float focal;
uniform float kappa;
uniform vec2 srcTanHalf;
uniform mat3 camRot;
varying vec2 vUv;
void main() {
  vec2 mm = (vUv - 0.5) * sensor;
  float rho = length(mm);
  float theta = kappa < 1e-6 ? rho / focal : atan(kappa * rho / focal) / kappa;
  vec2 dir2 = rho > 1e-9 ? mm / rho : vec2(0.0);
  vec3 ray = vec3(sin(theta) * dir2, -cos(theta));
  if (useCube) {
    gl_FragColor = textureCube(tCube, camRot * ray);
  } else {
    vec2 p = ray.xy / max(-ray.z, 1e-6);
    gl_FragColor = texture2D(tSrc, 0.5 + p / (2.0 * srcTanHalf));
  }
  #include <colorspace_fragment>
}
`

export interface LensFrame {
  camera: Pick<RenderCamera, 'position' | 'target' | 'roll'>
  lens: Lens
  /** Output size in pixels (drawing-buffer pixels). */
  width: number
  height: number
  /** Source oversampling for the perspective path. */
  supersample?: number
  cubeSize?: number
}

/** Renders a scene through a Render Camera's lens. One instance per WebGLRenderer. */
export class LensRenderer {
  private src = new WebGLRenderTarget(1, 1, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, samples: 4 })
  private cubeTarget: WebGLCubeRenderTarget | null = null
  private cubeCam: CubeCamera | null = null
  private srcCam = new PerspectiveCamera()
  private quadScene = new Scene()
  private quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private material = new ShaderMaterial({
    vertexShader, fragmentShader, depthTest: false, depthWrite: false,
    uniforms: {
      tSrc: { value: null }, tCube: { value: null }, useCube: { value: false },
      sensor: { value: new Vector2() }, focal: { value: 50 }, kappa: { value: 1 },
      srcTanHalf: { value: new Vector2(1, 1) }, camRot: { value: new Matrix3() },
    },
  })

  constructor() {
    const quad = new Mesh(new PlaneGeometry(2, 2), this.material)
    quad.frustumCulled = false
    this.quadScene.add(quad)
  }

  render(gl: WebGLRenderer, scene: Object3D, frame: LensFrame) {
    const { camera, lens, width, height } = frame
    const q: Quaternion = cameraQuaternion(camera.position, camera.target, camera.roll)
    const pos = new Vector3(...camera.position)
    const u = this.material.uniforms
    u.sensor.value.set(lens.sensorW, lens.sensorH)
    u.focal.value = lens.f
    u.kappa.value = lens.kappa
    u.useCube.value = lens.useCube

    const prevTarget = gl.getRenderTarget()
    if (lens.useCube) {
      const size = frame.cubeSize ?? 1024
      if (!this.cubeTarget || this.cubeTarget.width !== size) {
        this.cubeTarget?.dispose()
        this.cubeTarget = new WebGLCubeRenderTarget(size, { type: HalfFloatType, generateMipmaps: false, minFilter: LinearFilter })
        this.cubeCam = new CubeCamera(0.02, 1000, this.cubeTarget)
      }
      this.cubeCam!.position.copy(pos)
      this.cubeCam!.updateMatrixWorld()
      this.cubeCam!.update(gl, scene as Scene)
      u.tCube.value = this.cubeTarget.texture
      u.camRot.value.setFromMatrix4(new Matrix4().makeRotationFromQuaternion(q))
    } else {
      const ss = frame.supersample ?? 1.5
      const w = Math.min(4096, Math.ceil(width * ss))
      const h = Math.min(4096, Math.ceil(height * ss))
      if (this.src.width !== w || this.src.height !== h) this.src.setSize(w, h)
      this.srcCam.position.copy(pos)
      this.srcCam.quaternion.copy(q)
      this.srcCam.aspect = lens.srcTanHalfW / lens.srcTanHalfH
      this.srcCam.fov = (2 * Math.atan(lens.srcTanHalfH) * 180) / Math.PI
      this.srcCam.near = 0.02
      this.srcCam.far = 1000
      this.srcCam.updateProjectionMatrix()
      this.srcCam.updateMatrixWorld()
      gl.setRenderTarget(this.src)
      gl.clear()
      gl.render(scene, this.srcCam)
      u.tSrc.value = this.src.texture
      u.srcTanHalf.value.set(lens.srcTanHalfW, lens.srcTanHalfH)
    }
    gl.setRenderTarget(prevTarget)
    gl.render(this.quadScene, this.quadCam)
  }

  dispose() {
    this.src.dispose()
    this.cubeTarget?.dispose()
    this.material.dispose()
  }
}
