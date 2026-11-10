import { mkdirSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { StudioStore } from '../electron/store'
import { StudioService } from '../electron/service'
import { CreativeAgent } from '../electron/agent'
import { promptToDoc } from '../src/lib/promptSerialize'
import { promptStyleFor } from '../src/lib/recommend'
import type { GenerateRequest } from '../server/taskParams'

const directory = process.argv[2]
if (!directory) throw new Error('Pass a new directory for the paired originals')
mkdirSync(directory)
const store = new StudioStore(directory)
const keys = { pixaiKey: process.env.PIXAI_API_KEY!, llmKey: process.env.LLM_MODEL_API_KEY!, llmBaseUrl: process.env.LLM_MODEL_BASE_URL!, llmModel: process.env.LLM_MODEL_NAME! }
const service = new StudioService(store, () => keys, () => {})
const agent = new CreativeAgent(store, service, () => keys, () => {})
const model = { versionId: '1769967985062112358', title: 'tsubaki_mix v1.5', type: 'SDXL_MODEL' }
const prompt = '二次元插画，一位短黑发的成年女画家穿黄色雨衣，在雨中的街角拿着红色画册。'
const params = { aspectRatio: '1:1' as const, size: '1k' as const, batchSize: 1 as const, seed: 23819, steps: 25, cfgScale: 5, sampler: 'Euler', negativePrompt: '' }
const snapshot = { doc: promptToDoc(prompt), promptContext: { model, loras: [], referenceLabels: [], guidance: { style: promptStyleFor(model.type), verification: 'provisional' as const, source: 'playground promptStyleFor heuristic' } }, references: [], loras: [], recipeIds: [], lockedContents: ['短黑发', '黄色雨衣', '红色画册'], modelVersionId: model.versionId, params }
try {
  const work = service.createWork('雨中画家 · Prompt 对照', snapshot)
  const proposal = await agent.enhance({ workId: work.id, prompt, snapshot })
  const request: GenerateRequest = { prompt, modelVersionId: model.versionId, modelType: model.type, recipeIds: [], loras: [], contextImages: [], aspectRatio: params.aspectRatio, size: params.size, batchSize: 1, seed: params.seed, sampling: { method: params.sampler, steps: params.steps, cfgScale: params.cfgScale } }
  console.log(JSON.stringify({ workId: work.id, directory, original: prompt, proposal }))
  for (const candidate of [prompt, proposal.prompt]) {
    const job = await service.generate(work.id, { ...request, prompt: candidate }, { ...snapshot, doc: promptToDoc(candidate) })
    console.log(JSON.stringify({ job: job?.id, remote: job?.data.remoteId, status: job?.data.status }))
    if (!job?.data.remoteId) throw new Error('Submission uncertain; inspect existing work')
  }
  while (true) {
    await service.poll()
    const jobs = store.list('job', work.id)
    if (jobs.some(j => j.data.status === 'failed')) throw new Error('Remote generation failed')
    if (jobs.every(j => j.data.saveStatus === 'saved')) break
    await delay(3000)
  }
  console.log(JSON.stringify({ images: store.list('asset', work.id).map(a => ({ filename: a.data.filename, revisionId: a.data.revisionId })) }))
} finally { agent.stop(); store.close() }
