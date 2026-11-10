import { create } from 'zustand'
import type { SuggestionProps } from '@tiptap/suggestion'

export type SuggestionKind = 'slash' | 'at'

/** Mirrors the active tiptap Suggestion session so a React menu can render and drive it. */
interface SuggestionStore {
  kind: SuggestionKind | null
  query: string
  rect: DOMRect | null
  selectedIndex: number
  itemCount: number
  /** The suggestion's own command: deletes the typed trigger (slash) or inserts a mention (at). */
  command: ((props: Record<string, unknown>) => void) | null
  /** Registered by the menu: what Enter/Tab should do with the highlighted item. */
  onPick: (() => void) | null

  start: (kind: SuggestionKind, props: SuggestionProps) => void
  update: (props: SuggestionProps) => void
  exit: () => void
  move: (delta: number) => void
  setItemCount: (n: number) => void
  setOnPick: (fn: (() => void) | null) => void
}

export const useSuggestionStore = create<SuggestionStore>()((set, get) => ({
  kind: null,
  query: '',
  rect: null,
  selectedIndex: 0,
  itemCount: 0,
  command: null,
  onPick: null,

  start: (kind, props) => set({ kind, query: props.query, rect: props.clientRect?.() ?? null, selectedIndex: 0, command: props.command }),
  update: props => set({ query: props.query, rect: props.clientRect?.() ?? null, selectedIndex: 0, command: props.command }),
  exit: () => set({ kind: null, query: '', rect: null, selectedIndex: 0, command: null, onPick: null }),
  move: delta => {
    const { itemCount, selectedIndex } = get()
    if (!itemCount) return
    set({ selectedIndex: (selectedIndex + delta + itemCount) % itemCount })
  },
  setItemCount: n => set(s => ({ itemCount: n, selectedIndex: Math.min(s.selectedIndex, Math.max(0, n - 1)) })),
  setOnPick: fn => set({ onPick: fn }),
}))

/** Render adapter handed to tiptap's Suggestion: bridges its lifecycle into the store. */
export function suggestionRenderer(kind: SuggestionKind) {
  return () => ({
    onStart: (props: SuggestionProps) => useSuggestionStore.getState().start(kind, props),
    onUpdate: (props: SuggestionProps) => useSuggestionStore.getState().update(props),
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      const s = useSuggestionStore.getState()
      if (event.key === 'ArrowDown') { s.move(1); return true }
      if (event.key === 'ArrowUp') { s.move(-1); return true }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (s.onPick) { s.onPick(); return true }
        return false
      }
      if (event.key === 'Escape') { s.exit(); return true }
      return false
    },
    onExit: () => useSuggestionStore.getState().exit(),
  })
}
