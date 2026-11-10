/** Metres, Y up. A Figure faces +Z at yaw 0, so its left side is +X. */
export type Vec3 = [number, number, number]
/** Degrees about X, Y, Z, applied in Euler order `JOINT_EULER_ORDER`. */
export type Rot3 = [number, number, number]

export const JOINT_EULER_ORDER = 'XZY' as const

export const JOINT_NAMES = [
  'pelvis', 'waist', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR',
  'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR',
] as const
export type JointName = (typeof JOINT_NAMES)[number]

export type Pose = Record<JointName, Rot3>

export type Proportion = 'adult' | 'slender' | 'child'

export const PALETTE = [
  { id: 'red', hex: '#e5484d' },
  { id: 'blue', hex: '#3e63dd' },
  { id: 'green', hex: '#30a46c' },
  { id: 'yellow', hex: '#f5c518' },
  { id: 'purple', hex: '#8e4ec6' },
  { id: 'orange', hex: '#f76b15' },
  { id: 'pink', hex: '#e93d82' },
  { id: 'cyan', hex: '#05a2c2' },
  { id: 'white', hex: '#f4f4f5' },
  { id: 'black', hex: '#27272a' },
] as const
export type PaletteColour = (typeof PALETTE)[number]['id']
/** Colours auto-assigned to new Figures, in order. */
export const AUTO_COLOURS: PaletteColour[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']
export const colourHex = (c: PaletteColour) => PALETTE.find(p => p.id === c)!.hex

export interface Figure {
  id: string
  colour: PaletteColour
  heightCm: number
  proportion: Proportion
  /** Ground point under the pelvis at rest. */
  position: Vec3
  /** Facing, degrees about world Y. */
  yaw: number
  pose: Pose
}

export type PropKind = 'box' | 'sphere' | 'cylinder' | 'plane'

export interface Prop {
  id: string
  kind: PropKind
  position: Vec3
  /** Degrees, Euler XYZ. */
  rotation: Rot3
  scale: Vec3
}

export interface RenderCamera {
  position: Vec3
  target: Vec3
  /** Degrees about the viewing axis. */
  roll: number
  /** Full-frame-equivalent focal length, 3–600 mm. */
  focalMm: number
  /** Lens distortion override (-0.2 pincushion … 1 fisheye); null derives it from focal length. */
  distortion: number | null
}

export type SceneLayout = 'single' | 'four'

export interface ReferenceScene {
  id: string
  figures: Figure[]
  props: Prop[]
  camera: RenderCamera
  layout: SceneLayout
  burnLabels: boolean
}

export const MAX_FIGURES = 6
export const HEIGHT_MIN_CM = 100
export const HEIGHT_MAX_CM = 220
export const DEFAULT_HEIGHT_CM = 170
