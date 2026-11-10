import type { RenderCamera } from './types.ts'

export const FOCAL_MIN = 3
export const FOCAL_MAX = 600
export const FOCAL_STOPS = [24, 35, 50, 85, 135]
export const DISTORTION_MIN = -0.2
export const DISTORTION_MAX = 1
/** Full-frame diagonal; focal lengths are equivalent to a 36×24 mm sensor at any aspect ratio. */
export const SENSOR_DIAG_MM = Math.hypot(36, 24)
/** Beyond this corner half-angle a single perspective render cannot cover the frame; render a cube map instead. */
export const CUBE_THRESHOLD_DEG = 70

const DEG = Math.PI / 180

/** Log-scale slider position (0…1) ↔ focal length. */
export const sliderToFocal = (t: number) => FOCAL_MIN * (FOCAL_MAX / FOCAL_MIN) ** Math.min(1, Math.max(0, t))
export const focalToSlider = (f: number) => Math.log(f / FOCAL_MIN) / Math.log(FOCAL_MAX / FOCAL_MIN)

/** Sensor width and height in mm for an image aspect (w/h), keeping the full-frame diagonal. */
export function sensorSize(aspect: number) {
  const h = SENSOR_DIAG_MM / Math.sqrt(1 + aspect * aspect)
  return { w: h * aspect, h }
}

/**
 * Default distortion for a focal length: full fisheye at 8 mm and below, easing to none by 50 mm,
 * none through 85 mm, then a slight pincushion growing toward 600 mm.
 */
export function derivedDistortion(f: number): number {
  if (f < 50) return Math.min(1, (Math.log(50 / f) / Math.log(50 / 8)) ** 2)
  if (f <= 85) return 0
  return -0.08 * Math.min(1, Math.log(f / 85) / Math.log(FOCAL_MAX / 85))
}

export const effectiveDistortion = (cam: Pick<RenderCamera, 'focalMm' | 'distortion'>) => cam.distortion ?? derivedDistortion(cam.focalMm)

/**
 * Lens projection ρ = f·tan(κθ)/κ. κ = 1 is rectilinear, κ = 0.5 stereographic (our fisheye end),
 * κ > 1 pincushion. Distortion 1 → κ 0.5, 0 → 1, -0.2 → 1.2.
 */
export const kappaFor = (d: number) => (d >= 0 ? 1 - 0.5 * d : 1 - d)

/** Angle from the optical axis (rad) for an image-plane radius ρ (mm). */
export const angleAtRadius = (rho: number, f: number, kappa: number) => (kappa < 1e-6 ? rho / f : Math.atan((kappa * rho) / f) / kappa)

/** Image-plane radius (mm) for an angle θ (rad); Infinity when the lens cannot image that angle. */
export function radiusAtAngle(theta: number, f: number, kappa: number) {
  if (kappa < 1e-6) return f * theta
  return kappa * theta >= Math.PI / 2 - 1e-9 ? Infinity : (f * Math.tan(kappa * theta)) / kappa
}

export interface Lens {
  f: number
  kappa: number
  aspect: number
  sensorW: number
  sensorH: number
  /** Half-angle to the frame corner, degrees. */
  cornerDeg: number
  useCube: boolean
  /** Perspective source: tan of half the horizontal and vertical field needed to cover the frame. */
  srcTanHalfW: number
  srcTanHalfH: number
}

export function lensFor(cam: Pick<RenderCamera, 'focalMm' | 'distortion'>, aspect: number): Lens {
  const f = cam.focalMm
  const kappa = kappaFor(effectiveDistortion(cam))
  const { w, h } = sensorSize(aspect)
  const corner = angleAtRadius(SENSOR_DIAG_MM / 2, f, kappa)
  const phi = Math.atan2(h, w)
  // Barrel lenses reach furthest at the corners, pincushion lenses at the edge midpoints.
  const srcTanHalfW = Math.max(Math.tan(angleAtRadius(w / 2, f, kappa)), Math.tan(Math.min(corner, 89 * DEG)) * Math.cos(phi))
  const srcTanHalfH = Math.max(Math.tan(angleAtRadius(h / 2, f, kappa)), Math.tan(Math.min(corner, 89 * DEG)) * Math.sin(phi))
  const cornerDeg = corner / DEG
  return { f, kappa, aspect, sensorW: w, sensorH: h, cornerDeg, useCube: cornerDeg > CUBE_THRESHOLD_DEG, srcTanHalfW, srcTanHalfH }
}

/** Vertical field of view (degrees) of the undistorted lens, for previewing through an ordinary camera. */
export const rectilinearVFov = (f: number, aspect: number) => (2 * Math.atan(sensorSize(aspect).h / 2 / f)) / DEG
