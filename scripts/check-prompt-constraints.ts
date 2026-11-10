import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StudioStore } from '../electron/store'
import { StudioService } from '../electron/service'
import { CreativeAgent } from '../electron/agent'
import { promptToDoc } from '../src/lib/promptSerialize'
import type { ComposerState } from '../src/types'

const directory = mkdtempSync(join(tmpdir(), 'pixai-prompt-constraints-'))
const store = new StudioStore(directory)
const keys = { pixaiKey: '', llmKey: process.env.LLM_MODEL_API_KEY!, llmBaseUrl: process.env.LLM_MODEL_BASE_URL!, llmModel: process.env.LLM_MODEL_NAME! }
const service = new StudioService(store, () => keys, () => {})
const agent = new CreativeAgent(store, service, () => keys, () => {})
try {
  const references: ComposerState['references'] = [{ id: 'pose', url: 'studio-asset://local/pose.png', source: 'scene' }]
  const prompt = '二次元双人插画，image1 指定站位。左侧短黑发成年女画家递给右侧银发成年小提琴手一本红色画册，清晰线稿，赛璐璐阴影，雨夜街角。保持 chromatic_ink 风格。全身远景，同时必须是只见脸部的大特写。'
  const snapshot: Partial<ComposerState> = {
    references, doc: promptToDoc(prompt, references), lockedContents: ['左侧短黑发女画家把红色画册递给右侧银发小提琴手', '全身远景'],
    loras: [{ versionId: 'test-ink', weight: 0.7 }],
    promptContext: { loras: [{ versionId: 'test-ink', weight: 0.7, title: '测试墨线', triggerWords: ['chromatic_ink'] }], referenceLabels: [{ id: 'pose', label: 'image1' }], guidance: { source: 'test fixture', verification: 'provisional', style: 'unknown' } },
  }
  const result = await agent.enhance({ prompt, snapshot })
  if (!result.conflicts.length || !result.prompt.includes('chromatic_ink') || !/\bimage1\b/.test(result.prompt)) throw new Error('未保留引用、触发词或未报告冲突')
  console.log(JSON.stringify({ prompt: result.prompt, conflicts: result.conflicts, retained: result.retained, jobs: store.list('job').length }))
} finally { agent.stop(); store.close(); rmSync(directory, { recursive: true, force: true }) }
