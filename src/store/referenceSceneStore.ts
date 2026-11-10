import { create } from 'zustand'
import type { Figure, JointName, Prop, ReferenceScene } from '@/lib/reference-scene/types.ts'
import { cloneScene, createScene } from '@/lib/reference-scene/scene.ts'
import { useComposerStore } from './composerStore'

export type Selection =
  | { kind: 'figure'; id: string }
  | { kind: 'joint'; figureId: string; joint: JointName }
  | { kind: 'prop'; id: string }
  | { kind: 'camera' }
  | null

export type GizmoMode = 'translate' | 'rotate' | 'scale'

const HISTORY_LIMIT = 100

interface State {
  /** Reference Scenes bound to Scene References, by scene id. */
  scenes: Record<string, ReferenceScene>
  /** Open dialog: the Scene Reference being edited, or null for a fresh scene. */
  dialog: { referenceId: string | null } | null
  draft: ReferenceScene | null
  past: ReferenceScene[]
  future: ReferenceScene[]
  /** Continuous edits (a drag, a slider) with the same key share one history step. */
  gestureKey: string | null
  selection: Selection
  gizmoMode: GizmoMode
  lookThrough: boolean
  /** Lets Joints pass their range (Shift held, or the touch toggle). */
  unlocked: boolean
  /** Render View is the main pane in the single-view layout. */
  swapped: boolean
}

interface Actions {
  openNew: () => void
  openForReference: (referenceId: string) => void
  close: () => void
  /** Apply an edit to the draft. `key` merges consecutive edits into one undo step until endGesture. */
  edit: (recipe: (scene: ReferenceScene) => void, key?: string) => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  select: (sel: Selection) => void
  setGizmoMode: (m: GizmoMode) => void
  setLookThrough: (on: boolean) => void
  setUnlocked: (on: boolean) => void
  setSwapped: (on: boolean) => void
  /** Store the draft as the scene bound to a Scene Reference. */
  saveScene: (scene: ReferenceScene) => void
}

const fresh = (draft: ReferenceScene, referenceId: string | null): Partial<State> => ({
  dialog: { referenceId }, draft, past: [], future: [], gestureKey: null, selection: null, gizmoMode: 'rotate', lookThrough: false, unlocked: false, swapped: false,
})

export const useReferenceSceneStore = create<State & Actions>()((set, get) => ({
  scenes: {},
  dialog: null,
  draft: null,
  past: [],
  future: [],
  gestureKey: null,
  selection: null,
  gizmoMode: 'rotate',
  lookThrough: false,
  unlocked: false,
  swapped: false,

  openNew: () => set(fresh(createScene(), null)),
  openForReference: referenceId => {
    const ref = useComposerStore.getState().references.find(r => r.id === referenceId)
    const scene = ref?.sceneId ? get().scenes[ref.sceneId] : undefined
    set(fresh(scene ? cloneScene(scene) : createScene(), scene ? referenceId : null))
  },
  close: () => set({ dialog: null, draft: null, past: [], future: [], selection: null, lookThrough: false }),

  edit: (recipe, key) => {
    const { draft, past, gestureKey } = get()
    if (!draft) return
    const next = structuredClone(draft)
    recipe(next)
    const merge = key !== undefined && key === gestureKey
    set({ draft: next, past: merge ? past : [...past, draft].slice(-HISTORY_LIMIT), future: [], gestureKey: key ?? null })
  },
  endGesture: () => set({ gestureKey: null }),
  undo: () => {
    const { draft, past, future } = get()
    if (!draft || !past.length) return
    set({ draft: past[past.length - 1], past: past.slice(0, -1), future: [draft, ...future], gestureKey: null, selection: validSelection(past[past.length - 1], get().selection) })
  },
  redo: () => {
    const { draft, past, future } = get()
    if (!draft || !future.length) return
    set({ draft: future[0], past: [...past, draft], future: future.slice(1), gestureKey: null, selection: validSelection(future[0], get().selection) })
  },
  // Unlocking past the range is a per-Joint decision: it ends when the selection moves on.
  select: selection => set(s => ({ selection, unlocked: JSON.stringify(selection) === JSON.stringify(s.selection) ? s.unlocked : false })),
  setGizmoMode: gizmoMode => set({ gizmoMode }),
  setLookThrough: lookThrough => set({ lookThrough }),
  setUnlocked: unlocked => set({ unlocked }),
  setSwapped: swapped => set({ swapped }),
  saveScene: scene => set(s => ({ scenes: { ...s.scenes, [scene.id]: structuredClone(scene) } })),
}))

/** Drop a selection whose object no longer exists (after undo/redo or delete). */
export function validSelection(scene: ReferenceScene, sel: Selection): Selection {
  if (!sel) return null
  if (sel.kind === 'figure') return scene.figures.some(f => f.id === sel.id) ? sel : null
  if (sel.kind === 'joint') return scene.figures.some(f => f.id === sel.figureId) ? sel : null
  if (sel.kind === 'prop') return scene.props.some(p => p.id === sel.id) ? sel : null
  return sel
}

export const findFigure = (scene: ReferenceScene | null, id: string | undefined): Figure | undefined => scene?.figures.find(f => f.id === id)
export const findProp = (scene: ReferenceScene | null, id: string | undefined): Prop | undefined => scene?.props.find(p => p.id === id)

/** A Reference Scene lives only as long as its Scene Reference: drop scenes whose Reference is gone. */
useComposerStore.subscribe((state, prev) => {
  if (state.references === prev.references) return
  const alive = new Set(state.references.map(r => r.sceneId).filter(Boolean))
  const { scenes } = useReferenceSceneStore.getState()
  const dead = Object.keys(scenes).filter(id => !alive.has(id))
  if (!dead.length) return
  const next = { ...scenes }
  for (const id of dead) delete next[id]
  useReferenceSceneStore.setState({ scenes: next })
})
