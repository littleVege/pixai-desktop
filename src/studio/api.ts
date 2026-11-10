import type { Recipe } from '../types'
export interface StudioEntity { id: string; kind: string; workId: string | null; createdAt: string; updatedAt: string; data: Record<string, any> }
export interface StudioSnapshot { works: StudioEntity[]; revisions: StudioEntity[]; jobs: StudioEntity[]; assets: StudioEntity[]; runs: StudioEntity[]; messages: StudioEntity[]; presets: StudioEntity[]; preferences: StudioEntity[] }
interface ChatGPTSession { status: string; sharing: boolean; profileLabel?: string }
export interface StudioSettings { modelService: string; chatgptModel: string; chatgptSession: ChatGPTSession; visionBaseUrl: string; visionModel: string; visionConfigured: boolean; pixaiConfigured: boolean; llmConfigured: boolean; llmBaseUrl: string; llmModel: string }
export interface PromptSuggestion {
  prompt: string
  explanation: string
  retained: string[]
  added: string[]
  conflicts: string[]
  parameterSuggestions: string[]
}
export interface StudioBridge {
  snapshot(input?: { workId?: string }): Promise<StudioSnapshot>
  createWork(input: unknown): Promise<StudioEntity>
  saveDraft(input: unknown): Promise<StudioEntity>
  restoreRevision(input: { workId: string; revisionId: string; assetId?: string; expectedRevision: number }): Promise<StudioEntity>
  moveWork(input: { workId: string; libraryState: 'active' | 'archived' | 'deleted' }): Promise<StudioEntity>
  renameWork(input: unknown): Promise<StudioEntity>
  generate(input: unknown): Promise<StudioEntity>
  reconcileJob(input: { jobId: string; action: 'link'; remoteId: string } | { jobId: string; action: 'stopTracking' }): Promise<StudioEntity>
  chatgptLogin(): Promise<ChatGPTSession>
  chatgptCancel(): Promise<void>
  chatgptLogout(): Promise<void>
  chatgptUsage(): Promise<void>
  chatgptModels(): Promise<Array<{ slug: string; displayName: string }>>
  settings(): Promise<StudioSettings>
  saveSettings(input: unknown): Promise<unknown>
  checkCapabilities(): Promise<Array<{ capability: 'structured' | 'tools' | 'vision'; ok: boolean; detail: string }>>
  searchRecipes(input: { keyword: string; page: number; modelId?: string }): Promise<{ items: Recipe[]; totalPage: number }>
  searchModels(input: unknown): Promise<unknown>
  savePreset(input: unknown): Promise<StudioEntity>
  savePreference(input: { text: string; id?: string }): Promise<StudioEntity>
  confirmSave(input: { messageId: string; accept: boolean }): Promise<StudioEntity>
  setPreferenceActive(input: { id: string; active: boolean }): Promise<StudioEntity>
  pauseRun(input: unknown): Promise<StudioEntity>
  startAgent(input: unknown): Promise<StudioEntity>
  continueAgent(input: unknown): Promise<StudioEntity>
  enhancePrompt(input: unknown): Promise<PromptSuggestion>
  importReference(input: unknown): Promise<unknown>
  exportAsset(input: unknown): Promise<unknown>
  onChange(callback: () => void): () => void
}
declare global { interface Window { studio: StudioBridge } }
export const studio = window.studio
export const assetUrl = (filename: string, thumbnail = false) => `studio-asset://local/${encodeURIComponent(filename)}${thumbnail ? '?view=thumbnail' : ''}`
