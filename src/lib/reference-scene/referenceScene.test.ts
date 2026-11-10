import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { clampRotation, isOutOfRange, limitsFor, outOfRangeJoints } from './limits.ts'
import { emptyPose, mirrorPose, posesEqual } from './pose.ts'
import { A_POSE, POSE_PRESETS, PRESET_GROUPS } from './posePresets.ts'
import { buildRig, PROPORTION_IDS } from './rig.ts'
import { angleAtRadius, derivedDistortion, focalToSlider, kappaFor, lensFor, radiusAtAngle, sensorSize, sliderToFocal, SENSOR_DIAG_MM } from './lens.ts'
import { aimFromQuaternion, cameraQuaternion } from './camera.ts'
import { jointMatrices, labelAnchor, lowestPoint, snapToGround } from './fk.ts'
import { projectToImage } from './project.ts'
import { createFigure, createScene, nextColour, nextFigurePosition, renderSize } from './scene.ts'
import type { Figure } from './types.ts'

const fig = (patch: Partial<Figure> = {}): Figure => ({ ...createFigure([]), ...patch })

describe('joint limits', () => {
  it('mirrors the right side', () => {
    expect(limitsFor('shoulderL')[2]).toEqual([-20, 180])
    expect(limitsFor('shoulderR')[2]).toEqual([-180, 20])
    expect(limitsFor('shoulderR')[0]).toEqual(limitsFor('shoulderL')[0])
  })
  it('clamps to the range', () => {
    expect(clampRotation('kneeL', [200, 5, 0])).toEqual([150, 0, 0])
    expect(clampRotation('elbowL', [10, 0, 0])).toEqual([0, 0, 0])
  })
  it('lets Shift pass the limit', () => {
    expect(clampRotation('kneeL', [170, 0, 0], { allowOut: true })).toEqual([170, 0, 0])
  })
  it('keeps an already out-of-range axis where the drag started', () => {
    expect(clampRotation('kneeL', [175, 0, 0], { from: [170, 0, 0] })).toEqual([170, 0, 0])
    expect(clampRotation('kneeL', [160, 0, 0], { from: [170, 0, 0] })).toEqual([160, 0, 0])
  })
  it('flags out-of-range joints but never the pelvis', () => {
    expect(isOutOfRange('kneeL', [-10, 0, 0])).toBe(true)
    expect(isOutOfRange('pelvis', [180, 90, -180])).toBe(false)
    expect(outOfRangeJoints({ ...emptyPose(), kneeR: [151, 0, 0] })).toEqual(['kneeR'])
  })
})

describe('pose presets', () => {
  it('has 20–30 uniquely named presets covering every group', () => {
    expect(POSE_PRESETS.length).toBeGreaterThanOrEqual(20)
    expect(POSE_PRESETS.length).toBeLessThanOrEqual(30)
    expect(new Set(POSE_PRESETS.map(p => p.id)).size).toBe(POSE_PRESETS.length)
    for (const g of PRESET_GROUPS) expect(POSE_PRESETS.some(p => p.group === g)).toBe(true)
  })
  it.each(POSE_PRESETS.map(p => [p.id, p.pose] as const))('%s stays within range, mirrored too', (_, pose) => {
    expect(outOfRangeJoints(pose)).toEqual([])
    expect(outOfRangeJoints(mirrorPose(pose))).toEqual([])
  })
  it('mirroring twice is the identity and swaps sides', () => {
    const wave = POSE_PRESETS.find(p => p.id === 'wave')!.pose
    expect(posesEqual(mirrorPose(mirrorPose(wave)), wave)).toBe(true)
    expect(mirrorPose(wave).shoulderR).toEqual([wave.shoulderL[0], -wave.shoulderL[1], -wave.shoulderL[2]])
    expect(posesEqual(mirrorPose(A_POSE), A_POSE)).toBe(true)
  })
})

describe('rig', () => {
  it.each(PROPORTION_IDS)('%s crown lands at the Figure height', p => {
    for (const h of [100, 170, 220]) expect(buildRig(p, h).height).toBeCloseTo(h / 100, 6)
  })
  it('a child has a relatively larger head', () => {
    const head = (p: 'adult' | 'child') => { const r = buildRig(p, 150); return r.headTop / r.height }
    expect(head('child')).toBeGreaterThan(head('adult') * 1.4)
  })
})

describe('forward kinematics', () => {
  it('a standing Figure at the origin has its feet on the ground', () => {
    expect(lowestPoint(fig())).toBeCloseTo(0, 2)
  })
  it('yaw turns the Figure: at 90° its left hand points at -Z', () => {
    const m = jointMatrices(fig({ yaw: 90, pose: emptyPose() }))
    const p = new Vector3().setFromMatrixPosition(m.shoulderL)
    expect(p.z).toBeLessThan(-0.1)
    expect(Math.abs(p.x)).toBeLessThan(1e-6)
  })
  it('snap to ground brings a lying Figure down to the floor', () => {
    const lying = fig({ pose: POSE_PRESETS.find(p => p.id === 'lie-back')!.pose })
    const snapped = { ...lying, position: snapToGround(lying) }
    expect(lowestPoint(snapped)).toBeCloseTo(0, 6)
    expect(new Vector3().setFromMatrixPosition(jointMatrices(snapped).pelvis).y).toBeLessThan(0.2)
  })
  it('the label sits above the head', () => {
    expect(labelAnchor(fig())[1]).toBeGreaterThan(1.7)
  })
})

describe('lens', () => {
  it('keeps the full-frame diagonal at any aspect', () => {
    expect(sensorSize(1.5).w).toBeCloseTo(36, 6)
    const s = sensorSize(9 / 16)
    expect(Math.hypot(s.w, s.h)).toBeCloseTo(SENSOR_DIAG_MM, 6)
  })
  it('derives distortion from focal length', () => {
    expect(derivedDistortion(3)).toBe(1)
    expect(derivedDistortion(8)).toBeCloseTo(1, 6)
    expect(derivedDistortion(24)).toBeGreaterThan(0.1)
    expect(derivedDistortion(50)).toBe(0)
    expect(derivedDistortion(85)).toBe(0)
    expect(derivedDistortion(600)).toBeCloseTo(-0.08, 6)
  })
  it('radius and angle are inverse at every kappa', () => {
    for (const d of [-0.2, 0, 0.5, 1]) {
      const k = kappaFor(d)
      for (const theta of [0.1, 0.6, 1.2]) {
        const r = radiusAtAngle(theta, 20, k)
        if (Number.isFinite(r)) expect(angleAtRadius(r, 20, k)).toBeCloseTo(theta, 9)
      }
    }
  })
  it('a 50 mm lens on 3:2 sees 39.6° horizontally', () => {
    const lens = lensFor({ focalMm: 50, distortion: null }, 1.5)
    expect((2 * Math.atan(lens.srcTanHalfW) * 180) / Math.PI).toBeCloseTo(39.6, 1)
    expect(lens.useCube).toBe(false)
  })
  it('the widest lenses render through a cube map and stay under 180° half-angle', () => {
    const lens = lensFor({ focalMm: 3, distortion: null }, 1)
    expect(lens.useCube).toBe(true)
    expect(lens.cornerDeg).toBeLessThan(180)
  })
  it('slider mapping is log-scale and round-trips', () => {
    expect(sliderToFocal(0)).toBeCloseTo(3)
    expect(sliderToFocal(1)).toBeCloseTo(600)
    expect(sliderToFocal(focalToSlider(85))).toBeCloseTo(85, 9)
  })
})

describe('render camera', () => {
  it('looks along the target direction', () => {
    const q = cameraQuaternion([0, 1.5, 3], [0, 1, 0], 0)
    const fwd = new Vector3(0, 0, -1).applyQuaternion(q)
    expect(fwd.z).toBeLessThan(-0.9)
  })
  it('roll and aim survive a round trip', () => {
    const q = cameraQuaternion([1, 2, 3], [0, 1, 0], 25)
    const aim = aimFromQuaternion([1, 2, 3], q, Math.hypot(1, 1, 3))
    expect(aim.roll).toBeCloseTo(25, 3)
    aim.target.forEach((v, i) => expect(v).toBeCloseTo([0, 1, 0][i], 6))
  })
  it('handles looking straight down', () => {
    const q = cameraQuaternion([0, 5, 0], [0, 0, 0], 0)
    expect(new Vector3(0, 0, -1).applyQuaternion(q).y).toBeCloseTo(-1, 6)
    expect(q).toBeInstanceOf(Quaternion)
  })
})

describe('projection', () => {
  const cam = { position: [0, 1, 5] as [number, number, number], target: [0, 1, 0] as [number, number, number], roll: 0 }
  it('the target lands in the centre', () => {
    const lens = lensFor({ focalMm: 35, distortion: null }, 1)
    const [x, y] = projectToImage([0, 1, 0], cam, lens, 1000, 1000)!
    expect(x).toBeCloseTo(500, 6)
    expect(y).toBeCloseTo(500, 6)
  })
  it('points above the target land above the centre', () => {
    const lens = lensFor({ focalMm: 35, distortion: null }, 1)
    expect(projectToImage([0, 2, 0], cam, lens, 1000, 1000)![1]).toBeLessThan(500)
  })
  it('points behind the camera are not visible through a normal lens', () => {
    expect(projectToImage([0, 1, 10], cam, lensFor({ focalMm: 50, distortion: null }, 1), 100, 100)).toBeNull()
  })
})

describe('scene', () => {
  it('starts with one red Figure and a 50 mm camera', () => {
    const s = createScene()
    expect(s.figures).toHaveLength(1)
    expect(s.figures[0].colour).toBe('red')
    expect(s.camera.focalMm).toBe(50)
  })
  it('assigns the next unused colour and spreads Figures out', () => {
    const a = createFigure([])
    const b = { ...createFigure([a]) }
    expect(b.colour).toBe('blue')
    expect(nextColour([b])).toBe('red')
    expect(nextFigurePosition([a])).not.toEqual(nextFigurePosition([]))
  })
  it('renders 1024 on the long edge', () => {
    expect(renderSize('3:4')).toEqual([768, 1024])
    expect(renderSize('16:9')).toEqual([1024, 576])
    expect(renderSize('1:1')).toEqual([1024, 1024])
  })
})
