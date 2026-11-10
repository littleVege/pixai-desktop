import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { StudioStore } from '../electron/store'
import { StudioService } from '../electron/service'
import { CreativeAgent } from '../electron/agent'

const directory = mkdtempSync(join(tmpdir(), 'pixai-conversation-'))
const keys = { pixaiKey: '', llmKey: process.env.LLM_MODEL_API_KEY!, llmBaseUrl: process.env.LLM_MODEL_BASE_URL!, llmModel: process.env.LLM_MODEL_NAME! }
const snapshot = { doc: { type: 'doc', content: [] }, references: [], loras: [], recipeIds: [], modelVersionId: '', presetId: null, params: { aspectRatio: '1:1', size: '1k', batchSize: 1, steps: 25, cfgScale: 5, sampler: 'Euler', seed: null, negativePrompt: '' } }
async function turn(goal: string, existingWork?: string) {
  const store = new StudioStore(directory)
  const service = new StudioService(store, () => keys, () => {})
  const agent = new CreativeAgent(store, service, () => keys, () => {})
  try {
    const workId = existingWork ?? service.createWork('连续会话验证', snapshot).id
    const run = agent.start({ workId, goal, snapshot, maxImages: 1, maxModelCalls: 3 })
    const deadline = Date.now() + 100_000
    while (!['completed', 'paused', 'failed'].includes(String(store.get(run.id)?.data.status)) && Date.now() < deadline) await delay(150)
    if (store.get(run.id)?.data.status !== 'completed') throw new Error('会话未正常结束')
    const answer = store.list('message', workId).filter(m => m.data.runId === run.id && m.data.type === 'reply').map(m => m.data.text).join(' ')
    if (store.list('job').length) throw new Error('仅对话验证意外产生生图任务')
    return { workId, answer }
  } finally { agent.stop(); store.close() }
}
try {
  const code = randomUUID().slice(0, 8)
  const first = await turn('本作品的车站代号是 ' + code + '。这轮只回复收到，无需生成图片。')
  const second = await turn('我们上轮说的车站代号是什么？只回复代号，无需生成图片。', first.workId)
  if (!second.answer.includes(code)) throw new Error('第二轮未能恢复上轮代号')
  console.log('PASS: two real model turns, reopened SQLite, recalled unique station code, zero generation jobs')
  const store = new StudioStore(directory)
  const service = new StudioService(store, () => keys, () => {})
  const agent = new CreativeAgent(store, service, () => keys, () => {})
  try {
    const proposal = await agent.enhance({ workId: first.workId, prompt: '画一个二次元站台，把之前约定的车站代号原样写在站牌上。', snapshot: {} })
    if (!proposal.prompt.includes(code)) throw new Error('强化后的 Prompt 遗漏本作品约定的代号')
    console.log('PASS: Prompt Helper included the station code from persisted conversation')
  } finally { agent.stop(); store.close() }
  const seed = Math.floor(Math.random() * 1_000_000) + 100_000
  const presets = new StudioStore(directory)
  try {
    presets.create('preset', { title: '车站薄雾', snapshot: { ...snapshot, params: { ...snapshot.params, seed } } })
  } finally { presets.close() }
  const lookup = await turn('帮我查一下已保存的「车站薄雾」预设，告诉我它的 Seed。只查询。', first.workId)
  if (!lookup.answer.includes(String(seed))) throw new Error('Agent 未找回预设中的 Seed')
  console.log('PASS: Agent retrieved the saved preset and reported its unique seed')
  await turn('请把“喜欢低饱和冷色调”作为跨作品偏好，放进时间线让我确认保存。', first.workId)
  const pending = new StudioStore(directory)
  try {
    const proposal = pending.list('message', first.workId).find(message => message.data.type === 'saveProposal' && message.data.target === 'preference')
    if (!proposal || pending.activePreferences().length) throw new Error('偏好没有等待用户确认')
    pending.confirmSave(proposal.id, true)
    if (!pending.activePreferences().some(item => String(item.text).includes('低饱和'))) throw new Error('已确认的偏好未生效')
    console.log('PASS: Agent proposed a preference, effective only after confirmation')
  } finally { pending.close() }
} finally {
  if (process.argv.includes('--keep')) console.log('Test work directory:', directory)
  else rmSync(directory, { recursive: true, force: true })
}
