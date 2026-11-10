import type { ComposerState, Conflicts } from '@/types'

/**
 * Backend precedence (see docs/DESIGN.md §5): LoRA overrides References, References override the negative prompt.
 * Nothing is blocked; the UI marks the losing side as ignored.
 */
export function conflicts(state: Pick<ComposerState, 'loras' | 'references' | 'params'>): Conflicts {
  const hasLoras = state.loras.length > 0
  const hasRefs = state.references.length > 0
  const referencesIgnored = hasLoras && hasRefs
  const referencesEffective = hasRefs && !referencesIgnored
  const negativePromptIgnored = referencesEffective && state.params.negativePrompt.trim().length > 0
  return { referencesIgnored, negativePromptIgnored }
}
