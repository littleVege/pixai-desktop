import type { ThreeEvent } from '@react-three/fiber'
import { DoubleSide, FrontSide } from 'three'
import type { Prop } from '@/lib/reference-scene/types.ts'
import { objectName } from './names'

const DEG = Math.PI / 180

/** Unit-sized primitive; the Prop's scale sets its real size in metres. */
export function PropMesh({ prop, selected, onPick }: { prop: Prop; selected?: boolean; onPick?: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <mesh
      name={objectName.prop(prop.id)}
      position={prop.position}
      rotation={prop.rotation.map(d => d * DEG) as [number, number, number]}
      scale={prop.scale}
      castShadow
      receiveShadow
      onClick={onPick ? e => { if (e.delta > 4) return; e.stopPropagation(); onPick(e) } : undefined}
    >
      {prop.kind === 'box' && <boxGeometry args={[1, 1, 1]} />}
      {prop.kind === 'sphere' && <sphereGeometry args={[0.5, 32, 16]} />}
      {prop.kind === 'cylinder' && <cylinderGeometry args={[0.5, 0.5, 1, 32]} />}
      {prop.kind === 'plane' && <planeGeometry args={[1, 1]} />}
      <meshStandardMaterial color={selected ? '#b4b8c0' : '#a1a5ad'} roughness={0.9} side={prop.kind === 'plane' ? DoubleSide : FrontSide} />
    </mesh>
  )
}
