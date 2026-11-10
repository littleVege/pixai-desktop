import type { ComposerState } from '../src/types'
import { docToPrompt } from '../src/lib/promptSerialize'

/** Preserve reference semantics and declared trigger phrases independently of LLM self-assessment. */
export function validatePromptAssets(prompt: string, state: Partial<ComposerState>) {
  const original = docToPrompt(state.doc, state.references ?? [])
  const required = [...original.matchAll(/\bimage([1-9]\d*)\b/g)].map(match => match[0])
  for (const label of new Set(required)) if (!new RegExp(`\\b${label}\\b`).test(prompt)) throw new Error(`候选遗漏参考图标记 ${label}`)
  for (const lora of state.promptContext?.loras ?? []) {
    if (!state.loras?.some(selected => selected.versionId === lora.versionId && selected.weight > 0)) continue
    for (const word of lora.triggerWords) if (!prompt.toLowerCase().includes(word.toLowerCase())) throw new Error(`候选遗漏 LoRA 触发词：${word}`)
  }
}
