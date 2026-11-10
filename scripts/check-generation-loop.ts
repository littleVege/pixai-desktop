import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { StudioStore } from '../electron/store'
import { StudioService } from '../electron/service'
import { CreativeAgent } from '../electron/agent'

const directory = process.argv[2]
if (!directory || existsSync(directory)) throw new Error('Pass a new test directory. Existing runs must be inspected in place.')
mkdirSync(directory, { recursive: true })
const store = new StudioStore(directory)
const keys = { pixaiKey: process.env.PIXAI_API_KEY!, llmKey: process.env.LLM_MODEL_API_KEY!, llmBaseUrl: process.env.LLM_MODEL_BASE_URL!, llmModel: process.env.LLM_MODEL_NAME!, visionModel: process.env.VISION_MODEL_NAME, visionBaseUrl: process.env.VISION_MODEL_BASE_URL, visionKey: process.env.VISION_MODEL_API_KEY }
const service = new StudioService(store, () => keys, () => {})
const agent = new CreativeAgent(store, service, () => keys, () => {})
try {
  const model = { versionId: '1769967985062112358', title: 'tsubaki_mix v1.5', type: 'SDXL_MODEL' }
  const correction = process.argv.includes('--correction')
  const goal = correction ? '这是同一幅紫藤插画的两次创作。第一轮只出一张白墙紫藤的黑白线稿并检查实图；第二轮根据看到的线条和构图，只出一张上色版，紫色花朵、白墙，保留构图，并检查最终着色。总共两轮，每轮一张。' : '用所选模型实际生成一张白墙前垂落紫藤花的二次元插画。只生成一张。完成后看图检查花朵颜色，并告诉我结果。'
  const snapshot = { modelVersionId: model.versionId, promptContext: { model, loras: [], referenceLabels: [] }, doc: { type: 'doc', content: [] }, references: [], loras: [], recipeIds: [], params: { aspectRatio: '1:1', size: '1k', batchSize: 1, steps: 25, cfgScale: 5, sampler: 'Euler', negativePrompt: '', seed: null } }
  service.start()
  agent.watch()
  const work = service.createWork('紫藤 · Agent 端到端验证', snapshot)
  const run = agent.start({ workId: work.id, goal, snapshot, maxImages: correction ? 2 : 1, maxModelCalls: correction ? 14 : 8 })
  let previous = ''
  while (true) {
    const current = store.get(run.id)!.data
    const jobs = store.list('job', work.id)
    const status = JSON.stringify({ run: current.status, reason: current.reason, calls: current.modelCalls, images: current.imagesSpent, jobs: jobs.map(j => ({ id: j.id, remoteId: j.data.remoteId, status: j.data.status, saveStatus: j.data.saveStatus })) })
    if (status !== previous) { console.log(status); previous = status }
    if (['completed', 'failed', 'paused'].includes(String(current.status))) {
      const assets = store.list('asset', work.id).filter(a => a.data.source === 'generation')
      const inspected = store.list('message', work.id).some(m => m.data.type === 'inspection' && Array.isArray(m.data.assetIds) && assets.some(a => (m.data.assetIds as string[]).includes(a.id)))
      const expected = correction ? 2 : 1
      const reports = store.list('message', work.id).filter(m => m.data.type === 'inspection')
      const revisions = store.list('revision', work.id)
      const linked = !correction || (revisions.length === 2 && revisions[0].data.parentId === revisions[1].id && Number(current.rounds) === 2)
      const passed = current.status === 'completed' && jobs.length === expected && assets.length === expected && inspected && linked &&
        assets.every(asset => existsSync(join(directory, 'assets', String(asset.data.filename))) && reports.some(r => Array.isArray(r.data.assetIds) && r.data.assetIds.includes(asset.id)))
      console.log(JSON.stringify({ passed, workId: work.id, runId: run.id, directory }))
      if (!passed) process.exitCode = 1
      break
    }
    await delay(1500)
  }
} finally { agent.stop(); service.stop(); store.close() }
