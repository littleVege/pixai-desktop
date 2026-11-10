import { memo, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { buildRig, type Rig, type Segment } from '@/lib/reference-scene/rig.ts'
import { isOutOfRange } from '@/lib/reference-scene/limits.ts'
import { JOINT_EULER_ORDER, JOINT_NAMES, colourHex, type Figure, type JointName } from '@/lib/reference-scene/types.ts'
import { objectName } from './names'

const DEG = Math.PI / 180

export interface FigureInteraction {
  /** Show Joint handles (the Figure or one of its Joints is selected). */
  showHandles: boolean
  selectedJoint: JointName | null
  onPick?: (target: { kind: 'figure' } | { kind: 'joint'; joint: JointName }, e: ThreeEvent<MouseEvent>) => void
}

const CHILDREN: Record<JointName | 'root', JointName[]> = (() => {
  const map = { root: [] } as unknown as Record<JointName | 'root', JointName[]>
  for (const j of JOINT_NAMES) map[j] = []
  return map
})()

function SegmentMesh({ seg, colour }: { seg: Segment; colour: string }) {
  const mat = <meshStandardMaterial color={colour} roughness={0.85} metalness={0} />
  switch (seg.shape) {
    case 'capsule':
      return <mesh position={seg.center} scale={seg.scale} castShadow receiveShadow><capsuleGeometry args={[seg.radius, seg.length, 6, 16]} />{mat}</mesh>
    case 'ellipsoid':
      return <mesh position={seg.center} scale={seg.radii} castShadow receiveShadow><sphereGeometry args={[1, 24, 16]} />{mat}</mesh>
    case 'box':
      return <mesh position={seg.center} castShadow receiveShadow><boxGeometry args={seg.size} />{mat}</mesh>
    case 'cone':
      return <mesh position={seg.center} rotation={seg.rotation.map(d => d * DEG) as [number, number, number]} castShadow><coneGeometry args={[seg.radius, seg.height, 12]} />{mat}</mesh>
  }
}

function JointNode({ name, fig, rig, colour, tree, interaction }: { name: JointName; fig: Figure; rig: Rig; colour: string; tree: Record<JointName, JointName[]>; interaction?: FigureInteraction }) {
  const { offset } = rig.joints[name]
  const [x, y, z] = fig.pose[name]
  const segs = rig.segments.filter(s => s.owner === name)
  const out = isOutOfRange(name, fig.pose[name])
  const selected = interaction?.selectedJoint === name
  const pick = (e: ThreeEvent<MouseEvent>) => {
    if (!interaction?.onPick || e.delta > 4) return
    e.stopPropagation()
    interaction.onPick(name === 'pelvis' ? { kind: 'figure' } : { kind: 'joint', joint: name }, e)
  }
  return (
    <group name={objectName.joint(fig.id, name)} position={offset} rotation={[x * DEG, y * DEG, z * DEG, JOINT_EULER_ORDER]}>
      <group onClick={interaction ? pick : undefined}>
        {segs.map((s, i) => <SegmentMesh key={i} seg={s} colour={colour} />)}
      </group>
      {interaction?.showHandles && (
        <mesh
          renderOrder={10}
          onClick={e => { if (!interaction.onPick || e.delta > 4) return; e.stopPropagation(); interaction.onPick({ kind: 'joint', joint: name }, e) }}
        >
          <sphereGeometry args={[rig.handleRadius * (selected ? 1.35 : 1), 16, 12]} />
          <meshBasicMaterial color={out ? '#ef4444' : selected ? '#facc15' : '#ffffff'} depthTest={false} transparent opacity={0.95} />
        </mesh>
      )}
      {tree[name].map(c => <JointNode key={c} name={c} fig={fig} rig={rig} colour={colour} tree={tree} interaction={interaction} />)}
    </group>
  )
}

/** A posable mannequin. Out-of-range Joints are tinted red in the editor. */
export const FigureMesh = memo(function FigureMesh({ fig, interaction }: { fig: Figure; interaction?: FigureInteraction }) {
  const rig = useMemo(() => buildRig(fig.proportion, fig.heightCm), [fig.proportion, fig.heightCm])
  const kids = useMemo(() => {
    const map = structuredClone(CHILDREN)
    for (const j of JOINT_NAMES) { const p = rig.joints[j].parent; if (p) map[p].push(j) }
    return map
  }, [rig])
  return (
    <group name={objectName.figure(fig.id)} position={fig.position} rotation={[0, fig.yaw * DEG, 0]}>
      <JointNode name="pelvis" fig={fig} rig={rig} colour={colourHex(fig.colour)} tree={kids} interaction={interaction} />
    </group>
  )
})
