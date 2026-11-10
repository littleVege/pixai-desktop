import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import { StudioStore } from '../electron/store'
import { StudioService } from '../electron/service'
import { CreativeAgent } from '../electron/agent'

// Use the red/blue two-figure PNG exported by the scene editor during UI testing.
const source = process.argv[2]
if (!source) throw new Error('Pass the two-figure scene PNG as the first argument')
const dir = mkdtempSync(join(tmpdir(), 'pixai-history-image-'))
const store = new StudioStore(dir)
const keys = { pixaiKey: '', llmKey: process.env.LLM_MODEL_API_KEY!, llmBaseUrl: process.env.LLM_MODEL_BASE_URL!, llmModel: process.env.LLM_MODEL_NAME!, visionModel: process.env.VISION_MODEL_NAME, visionKey: process.env.VISION_MODEL_API_KEY, visionBaseUrl: process.env.VISION_MODEL_BASE_URL }
const service = new StudioService(store, () => keys, () => {})
const agent = new CreativeAgent(store, service, () => keys, () => {})
try {
  const snapshot = { references: [], loras: [], recipeIds: [], params: {}, modelVersionId: '' }
  const work = service.createWork('历史图验收', snapshot)
  const revision = store.create('revision', { snapshot }, work.id)
  const originals = [source, process.argv[3]].filter(Boolean)
  const [asset] = originals.map((file, index) => {
    const filename = `image-${index}${extname(file)}`
    copyFileSync(file, join(dir, 'assets', filename))
    return store.create('asset', { source: 'generation', revisionId: revision.id, filename }, work.id)
  })
  store.restoreRevision(work.id, revision.id, 0, asset.id)
  const goal = originals.length === 2 ? '请看我选中的那张图。人物头顶上方是什么物件？只回答观察结果。' : '请查看选中的图，实际画面里有几个人偶？分别是什么颜色？只回答看图结果。'
  const run = agent.start({ workId: work.id, goal, snapshot, maxImages: 1, maxModelCalls: 5 })
  const deadline = Date.now() + 120_000
  while (!['paused', 'completed', 'failed'].includes(String(store.get(run.id)?.data.status)) && Date.now() < deadline) await delay(200)
  const messages = store.list('message', work.id)
  const inspection = messages.find(m => m.data.type === 'inspection' && Array.isArray(m.data.assetIds) && m.data.assetIds.includes(asset.id))
  const answer = messages.filter(m => m.data.type === 'reply').map(m => m.data.text).join(' ')
  const correct = originals.length === 2 ? /伞|傘|umbrella/i.test(answer) : /红|紅|red/i.test(answer) && /蓝|藍|blue/i.test(answer) && /两|二|2|two/i.test(answer)
  console.log(JSON.stringify({ status: store.get(run.id)?.data.status, inspected: !!inspection, answer, jobs: store.list('job').length }))
  if (!correct || !inspection || store.get(run.id)?.data.status !== 'completed' || store.list('job').length) process.exitCode = 1
} finally { agent.stop(); store.close(); rmSync(dir, { recursive: true, force: true }) }
