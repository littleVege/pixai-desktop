import type { JointName, Pose, Rot3 } from './types.ts'
import { poseFrom } from './pose.ts'

export type PresetGroup = 'standing' | 'sitting' | 'lying' | 'action' | 'expressive'
export const PRESET_GROUPS: PresetGroup[] = ['standing', 'sitting', 'lying', 'action', 'expressive']

export interface PosePreset {
  id: string
  group: PresetGroup
  pose: Pose
}

type Limb = 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle'
type LimbPose = Partial<Record<Limb, Rot3>>

/** Limb rotations are authored in left-side terms (Z+ = away from the body) and mirrored for the right. */
const toRight = ([x, y, z]: Rot3): Rot3 => [x, y === 0 ? 0 : -y, z === 0 ? 0 : -z]
const entries = (limbs: LimbPose) => Object.entries(limbs) as [Limb, Rot3][]
const L = (limbs: LimbPose) => Object.fromEntries(entries(limbs).map(([k, v]) => [`${k}L`, v])) as Partial<Pose>
const R = (limbs: LimbPose) => Object.fromEntries(entries(limbs).map(([k, v]) => [`${k}R`, toRight(v)])) as Partial<Pose>
const both = (limbs: LimbPose) => ({ ...L(limbs), ...R(limbs) })

const p = (id: string, group: PresetGroup, ...parts: Partial<Record<JointName, Rot3>>[]): PosePreset =>
  ({ id, group, pose: poseFrom(Object.assign({}, ...parts)) })

export const A_POSE = poseFrom(both({ shoulder: [0, 0, 30], elbow: [-5, 0, 0] }))

export const POSE_PRESETS: PosePreset[] = [
  // standing
  { id: 'a-pose', group: 'standing', pose: A_POSE },
  p('t-pose', 'standing', both({ shoulder: [0, 0, 90] })),
  p('relaxed', 'standing', both({ shoulder: [0, 0, 8], elbow: [-12, 0, 0], hip: [0, 0, 3] }), { neck: [4, 0, 0] }),
  p('contrapposto', 'standing',
    { pelvis: [0, 0, -4], chest: [0, 0, 5], neck: [0, 8, 0], head: [0, 0, -4] },
    L({ shoulder: [0, 0, 10], elbow: [-15, 0, 0], hip: [-6, 0, 4], knee: [16, 0, 0], ankle: [-4, 0, 0] }),
    R({ shoulder: [0, 0, 12], elbow: [-20, 0, 0], hip: [2, 0, 2] })),
  p('hands-on-hips', 'standing', both({ shoulder: [12, -75, 48], elbow: [-105, 0, 0], wrist: [20, 0, 0], hip: [0, 0, 6] })),
  p('arms-crossed', 'standing', both({ shoulder: [-20, -70, 15], elbow: [-115, 0, 0], hip: [0, 0, 4] }), { head: [-5, 0, 0] }),
  p('wave', 'standing',
    L({ shoulder: [0, 90, 95], elbow: [-75, 0, 0] }), R({ shoulder: [0, 0, 8], elbow: [-10, 0, 0] }),
    { head: [0, 0, -6] }),
  p('point', 'standing',
    R({ shoulder: [-90, 0, 5], elbow: [-5, 0, 0] }), L({ shoulder: [0, 0, 8], elbow: [-10, 0, 0] }),
    { chest: [0, 10, 0], neck: [0, -8, 0] }),
  p('thinking', 'standing',
    R({ shoulder: [-35, -40, 10], elbow: [-140, 0, 0], wrist: [-20, 0, 0] }),
    L({ shoulder: [-15, -70, 10], elbow: [-95, 0, 0] }),
    { head: [10, 0, 6], neck: [5, 0, 0] }),
  p('hands-behind-back', 'standing', both({ shoulder: [30, -70, 15], elbow: [-70, 0, 0], hip: [0, 0, 3] }), { chest: [-5, 0, 0] }),

  // sitting
  p('sit-chair', 'sitting', both({ hip: [-90, 0, 6], knee: [90, 0, 0], shoulder: [-20, 0, 8], elbow: [-70, 0, 0] }), { waist: [5, 0, 0] }),
  p('sit-cross-legged', 'sitting', both({ hip: [-80, 45, 50], knee: [140, 0, 0], ankle: [10, 0, 0], shoulder: [-25, 0, 12], elbow: [-50, 0, 0] }), { waist: [10, 0, 0] }),
  p('hug-knees', 'sitting', both({ hip: [-120, 0, 8], knee: [140, 0, 0], shoulder: [-60, -20, 10], elbow: [-60, 0, 0] }), { waist: [25, 0, 0], chest: [15, 0, 0], neck: [10, 0, 0] }),
  p('seiza', 'sitting', both({ hip: [-85, 0, 4], knee: [150, 0, 0], ankle: [45, 0, 0], shoulder: [-25, 0, 6], elbow: [-50, 0, 0] })),
  p('kneel-one-knee', 'sitting',
    L({ hip: [-90, 0, 5], knee: [90, 0, 0] }), R({ hip: [10, 0, 2], knee: [100, 0, 0], ankle: [45, 0, 0] }),
    both({ shoulder: [-10, 0, 10], elbow: [-30, 0, 0] })),
  p('sit-lean-back', 'sitting', both({ hip: [-90, 0, 8], knee: [80, 0, 0], shoulder: [40, 0, 20], elbow: [-5, 0, 0], wrist: [-60, 0, 0] }), { waist: [-15, 0, 0], neck: [10, 0, 0] }),

  // lying
  p('lie-back', 'lying', { pelvis: [-90, 0, 0] }, both({ shoulder: [0, 0, 20], elbow: [-5, 0, 0] })),
  p('lie-front', 'lying', { pelvis: [90, 0, 0], neck: [-35, 0, 0], head: [-15, 0, 0] }, both({ shoulder: [-150, 0, 20], elbow: [-60, 0, 0] })),
  p('lie-side', 'lying', { pelvis: [0, 0, 90] },
    both({ hip: [-30, 0, 0], knee: [40, 0, 0] }),
    R({ shoulder: [0, 0, 160], elbow: [-90, 0, 0] }), L({ shoulder: [-30, 0, 5], elbow: [-30, 0, 0] })),
  p('lie-hands-behind-head', 'lying', { pelvis: [-90, 0, 0] }, both({ shoulder: [0, 90, 140], elbow: [-140, 0, 0] }), L({ hip: [-40, 0, 0], knee: [80, 0, 0] })),

  // action
  p('walk', 'action',
    L({ hip: [-25, 0, 2], knee: [10, 0, 0], shoulder: [20, 0, 6], elbow: [-15, 0, 0] }),
    R({ hip: [15, 0, 2], knee: [25, 0, 0], ankle: [15, 0, 0], shoulder: [-25, 0, 6], elbow: [-30, 0, 0] }),
    { chest: [0, -6, 0] }),
  p('run', 'action',
    L({ hip: [-60, 0, 3], knee: [80, 0, 0], shoulder: [45, 0, 10], elbow: [-90, 0, 0] }),
    R({ hip: [25, 0, 3], knee: [100, 0, 0], ankle: [30, 0, 0], shoulder: [-50, 0, 10], elbow: [-90, 0, 0] }),
    { waist: [10, 0, 0], chest: [5, -8, 0] }),
  p('jump', 'action', both({ hip: [-40, 0, 6], knee: [70, 0, 0], ankle: [35, 0, 0], shoulder: [0, 0, 160], elbow: [-10, 0, 0] }), { head: [-10, 0, 0] }),
  p('punch', 'action',
    R({ shoulder: [-90, 0, 0], elbow: [0, 0, 0], hip: [15, 0, 6], knee: [10, 0, 0] }),
    L({ shoulder: [-40, -20, 20], elbow: [-130, 0, 0], hip: [-30, 0, 8], knee: [25, 0, 0] }),
    { waist: [0, 10, 0], chest: [0, 25, 0] }),
  p('kick', 'action',
    R({ hip: [-90, 0, 0], knee: [10, 0, 0] }), L({ hip: [0, 0, 5], knee: [10, 0, 0] }),
    both({ shoulder: [0, 0, 60], elbow: [-30, 0, 0] }), { waist: [-10, 0, 0] }),
  p('sword-stance', 'action',
    both({ shoulder: [-45, -30, 10], elbow: [-60, 0, 0] }),
    L({ hip: [-30, 0, 10], knee: [30, 0, 0] }), R({ hip: [20, 0, 10], knee: [20, 0, 0] }),
    { chest: [0, 10, 0] }),
  p('crouch', 'action', both({ hip: [-110, 0, 20], knee: [130, 0, 0], ankle: [-25, 0, 0], shoulder: [-40, 0, 15], elbow: [-60, 0, 0] }), { waist: [20, 0, 0] }),

  // expressive
  p('cheer', 'expressive', both({ shoulder: [0, 0, 150], elbow: [-10, 0, 0] }), { head: [-10, 0, 0] }),
  p('shy', 'expressive', both({ shoulder: [-15, -40, 8], elbow: [-80, 0, 0] }), L({ hip: [-5, 0, -8], knee: [10, 0, 0] }), { head: [20, 0, 0], neck: [15, 0, 0] }),
  p('shrug', 'expressive', both({ shoulder: [-10, 60, 20], elbow: [-90, 0, 0] }), { head: [0, 0, 8] }),
]

export const findPreset = (id: string) => POSE_PRESETS.find(p => p.id === id)
