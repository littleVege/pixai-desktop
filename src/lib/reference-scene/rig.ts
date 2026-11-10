import type { JointName, Proportion, Rot3, Vec3 } from './types.ts'

/** Raw body measurements; the rig is scaled so the crown lands exactly at the Figure's height. */
interface Measurements {
  ankleH: number; shin: number; thigh: number; hipDrop: number; hipX: number
  waistUp: number; spineLower: number; spineUpper: number; neck: number; headR: number
  shoulderX: number; shoulderY: number; upperArm: number; forearm: number; hand: number; footLen: number
  /** Multiplier on limb and torso thickness. */
  thick: number
}

const ADULT: Measurements = {
  ankleH: 0.045, shin: 0.24, thigh: 0.245, hipDrop: 0.03, hipX: 0.052,
  waistUp: 0.02, spineLower: 0.11, spineUpper: 0.135, neck: 0.05, headR: 0.062,
  shoulderX: 0.105, shoulderY: 0.115, upperArm: 0.17, forearm: 0.15, hand: 0.105, footLen: 0.15, thick: 1,
}

export const PROPORTIONS: Record<Proportion, Measurements> = {
  adult: ADULT,
  slender: { ...ADULT, shin: 0.25, thigh: 0.255, hipX: 0.048, shoulderX: 0.098, thick: 0.84 },
  child: {
    ankleH: 0.04, shin: 0.2, thigh: 0.21, hipDrop: 0.03, hipX: 0.05,
    waistUp: 0.02, spineLower: 0.095, spineUpper: 0.11, neck: 0.035, headR: 0.1,
    shoulderX: 0.095, shoulderY: 0.09, upperArm: 0.15, forearm: 0.125, hand: 0.085, footLen: 0.13, thick: 1.05,
  },
}
export const PROPORTION_IDS = Object.keys(PROPORTIONS) as Proportion[]

/** Head ellipsoid: centre above the head joint and vertical radius, in headR units. */
const HEAD_CENTRE = 0.95
const HEAD_RY = 1.08

export type Segment =
  | { owner: JointName; shape: 'capsule'; center: Vec3; radius: number; length: number; scale: Vec3 }
  | { owner: JointName; shape: 'ellipsoid'; center: Vec3; radii: Vec3 }
  | { owner: JointName; shape: 'box'; center: Vec3; size: Vec3 }
  | { owner: JointName; shape: 'cone'; center: Vec3; radius: number; height: number; rotation: Rot3 }

export interface Rig {
  /** Pelvis joint height above the Figure's ground point at rest. */
  pelvisY: number
  joints: Record<JointName, { parent: JointName | null; offset: Vec3 }>
  segments: Segment[]
  /** Joint handle radius for the editor. */
  handleRadius: number
  /** Crown height, equals the Figure's height. */
  height: number
  /** Crown above the head joint, in the head's frame. */
  headTop: number
}

export function buildRig(proportion: Proportion, heightCm: number): Rig {
  const m = PROPORTIONS[proportion]
  const pelvisRaw = m.ankleH + m.shin + m.thigh + m.hipDrop
  const crownRaw = pelvisRaw + m.waistUp + m.spineLower + m.spineUpper + m.neck + m.headR * (HEAD_CENTRE + HEAD_RY)
  const s = heightCm / 100 / crownRaw
  const v = (x: number, y: number, z = 0): Vec3 => [x * s, y * s, z * s]
  const t = m.thick * s

  const joints: Rig['joints'] = {
    pelvis: { parent: null, offset: v(0, pelvisRaw) },
    waist: { parent: 'pelvis', offset: v(0, m.waistUp) },
    chest: { parent: 'waist', offset: v(0, m.spineLower) },
    neck: { parent: 'chest', offset: v(0, m.spineUpper) },
    head: { parent: 'neck', offset: v(0, m.neck) },
    shoulderL: { parent: 'chest', offset: v(m.shoulderX, m.shoulderY) },
    elbowL: { parent: 'shoulderL', offset: v(0, -m.upperArm) },
    wristL: { parent: 'elbowL', offset: v(0, -m.forearm) },
    shoulderR: { parent: 'chest', offset: v(-m.shoulderX, m.shoulderY) },
    elbowR: { parent: 'shoulderR', offset: v(0, -m.upperArm) },
    wristR: { parent: 'elbowR', offset: v(0, -m.forearm) },
    hipL: { parent: 'pelvis', offset: v(m.hipX, -m.hipDrop) },
    kneeL: { parent: 'hipL', offset: v(0, -m.thigh) },
    ankleL: { parent: 'kneeL', offset: v(0, -m.shin) },
    hipR: { parent: 'pelvis', offset: v(-m.hipX, -m.hipDrop) },
    kneeR: { parent: 'hipR', offset: v(0, -m.thigh) },
    ankleR: { parent: 'kneeR', offset: v(0, -m.shin) },
  }

  const limb = (owner: JointName, len: number, r: number): Segment =>
    ({ owner, shape: 'capsule', center: v(0, -len / 2), radius: r * t, length: Math.max(0.01, len * s - r * t), scale: [1, 1, 1] })

  const segments: Segment[] = [
    { owner: 'pelvis', shape: 'ellipsoid', center: v(0, -0.012), radii: [(m.hipX + 0.045) * t, 0.062 * t, 0.06 * t] },
    { owner: 'waist', shape: 'capsule', center: v(0, m.spineLower / 2), radius: 0.06 * t, length: Math.max(0.01, (m.spineLower - 0.06 * m.thick) * s), scale: [1.25, 1, 0.85] },
    { owner: 'chest', shape: 'capsule', center: v(0, m.spineUpper * 0.45), radius: 0.075 * t, length: m.spineUpper * 0.45 * s, scale: [1.45, 1, 0.88] },
    { owner: 'neck', shape: 'capsule', center: v(0, m.neck / 2), radius: 0.026 * t, length: m.neck * s, scale: [1, 1, 1] },
    { owner: 'head', shape: 'ellipsoid', center: v(0, m.headR * HEAD_CENTRE, 0.006), radii: v(m.headR * 0.86, m.headR * HEAD_RY, m.headR * 0.98) },
    { owner: 'head', shape: 'cone', center: v(0, m.headR * 0.82, m.headR * 1.0), radius: m.headR * 0.16 * s, height: m.headR * 0.3 * s, rotation: [90, 0, 0] },
    ...(['L', 'R'] as const).flatMap((side): Segment[] => [
      limb(`shoulder${side}`, m.upperArm, 0.028),
      limb(`elbow${side}`, m.forearm, 0.023),
      { owner: `wrist${side}`, shape: 'box', center: v(0, -m.hand / 2), size: [0.024 * t, m.hand * s, 0.055 * t] },
      limb(`hip${side}`, m.thigh, 0.045),
      limb(`knee${side}`, m.shin, 0.034),
      { owner: `ankle${side}`, shape: 'box', center: v(0, -m.ankleH / 2, m.footLen * 0.28), size: [0.05 * t, m.ankleH * s, m.footLen * s] },
    ]),
  ]
  return { pelvisY: pelvisRaw * s, joints, segments, handleRadius: 0.022 * s, height: crownRaw * s, headTop: m.headR * (HEAD_CENTRE + HEAD_RY) * s }
}
