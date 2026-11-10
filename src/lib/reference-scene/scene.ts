import { AUTO_COLOURS, DEFAULT_HEIGHT_CM, MAX_FIGURES, type Figure, type Prop, type PropKind, type ReferenceScene, type RenderCamera, type Vec3 } from './types.ts'
import { A_POSE } from './posePresets.ts'

let counter = 0
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

export const DEFAULT_CAMERA: RenderCamera = { position: [0, 1.5, 3], target: [0, 1, 0], roll: 0, focalMm: 50, distortion: null }

/** First auto colour no Figure uses yet; cycles once all six are taken. */
export function nextColour(figures: Figure[]) {
  const used = new Set(figures.map(f => f.colour))
  return AUTO_COLOURS.find(c => !used.has(c)) ?? AUTO_COLOURS[figures.length % AUTO_COLOURS.length]
}

export function createFigure(existing: Figure[], position: Figure['position'] = [0, 0, 0]): Figure {
  return { id: newId('fig'), colour: nextColour(existing), heightCm: DEFAULT_HEIGHT_CM, proportion: 'adult', position, yaw: 0, pose: structuredClone(A_POSE) }
}

/** Where to drop the next Figure: step sideways from the origin so Figures don't overlap. */
export function nextFigurePosition(existing: Figure[]): Figure['position'] {
  const n = existing.length
  if (n === 0) return [0, 0, 0]
  const step = Math.ceil(n / 2) * 0.8
  return [n % 2 ? step : -step, 0, 0]
}

export const canAddFigure = (scene: ReferenceScene) => scene.figures.length < MAX_FIGURES

const PROP_DEFAULTS: Record<PropKind, Pick<Prop, 'position' | 'scale'>> = {
  box: { position: [0, 0.25, -0.8], scale: [0.5, 0.5, 0.5] },
  sphere: { position: [0, 0.25, -0.8], scale: [0.5, 0.5, 0.5] },
  cylinder: { position: [0, 0.25, -0.8], scale: [0.5, 0.5, 0.5] },
  plane: { position: [0, 1, -1.5], scale: [3, 2, 1] },
}

export function createProp(kind: PropKind): Prop {
  const d = PROP_DEFAULTS[kind]
  return { id: newId('prop'), kind, position: [...d.position] as Vec3, rotation: [0, 0, 0], scale: [...d.scale] as Vec3 }
}

export function createScene(): ReferenceScene {
  return { id: newId('scene'), figures: [createFigure([])], props: [], camera: structuredClone(DEFAULT_CAMERA), layout: 'single', burnLabels: false }
}

export const cloneScene = (scene: ReferenceScene, id = scene.id): ReferenceScene => ({ ...structuredClone(scene), id })

/** Aspect ratio string 'w:h' → number. */
export function aspectOf(ratio: string) {
  const [w, h] = ratio.split(':').map(Number)
  return w > 0 && h > 0 ? w / h : 1
}

/** Output pixel size with the given long edge, both sides even. */
export function renderSize(ratio: string, longEdge = 1024): [number, number] {
  const a = aspectOf(ratio)
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
  return a >= 1 ? [longEdge, even(longEdge / a)] : [even(longEdge * a), longEdge]
}
