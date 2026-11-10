import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { StudioStore } from '../electron/store'
import { StudioService } from '../electron/service'
import { CreativeAgent } from '../electron/agent'
const store = new StudioStore(mkdtempSync(join(tmpdir(), 'pixai-agent-check-')))
const credentials = { pixaiKey: process.env.PIXAI_API_KEY!, llmKey: process.env.LLM_MODEL_API_KEY!, llmBaseUrl: process.env.LLM_MODEL_BASE_URL!, llmModel: process.env.LLM_MODEL_NAME! }
const service = new StudioService(store, () => credentials, () => {})
const agent = new CreativeAgent(store, service, () => credentials, () => {})
const snapshot = { doc: { type: 'doc', content: [] }, references: [], recipeIds: [], loras: [], modelVersionId: '', params: {}, lockedContents: [] }
const work = service.createWork('Agent integration check', snapshot)
const run = agent.start({ workId: work.id, goal: '请先搜索 Tsubaki 模型，再推荐一个适合银发女剑士、雨夜车站插画的模型，用两句中文解释。只推荐，不生成图片。', snapshot, maxImages: 0, maxModelCalls: 4 })
const deadline = setTimeout(() => { console.error('Agent check timed out; temporary state retained:', store.directory); process.exit(1) }, 120_000)
while (!['completed', 'paused', 'failed'].includes(String(store.get(run.id)?.data.status))) await new Promise(resolve => setTimeout(resolve, 200))
clearTimeout(deadline)
const final = store.get(run.id)!
const messages = store.list('message', work.id)
const tools = messages.filter(m => m.data.type === 'tool').map(m => ({ name: m.data.toolName, status: m.data.status }))
const replies = messages.filter(m => m.data.type === 'reply').map(m => String(m.data.text))
const redact = (text: string) => [credentials.llmKey, credentials.pixaiKey].filter(Boolean).reduce((value, key) => value.replaceAll(key, '[redacted]'), text)
console.log(JSON.stringify({ status: final.data.status, reason: final.data.reason ? redact(String(final.data.reason)) : undefined, modelCalls: final.data.modelCalls, inputTokens: final.data.inputTokens, outputTokens: final.data.outputTokens, tools, replies, generatedJobs: store.list('job').length }, null, 2))
const catalog = final.data.catalogSelections as Array<{ versionId: string; usageType: string }> | undefined
const passed = final.data.status === 'completed' && tools.some(t => t.name === 'search_models' && t.status === 'complete') && replies.some(text => text.length > 0) && store.list('job').length === 0 && !!catalog?.some(item => item.usageType === 'MODEL' && item.versionId)
agent.stop(); store.close(); rmSync(store.directory, { recursive: true, force: true })
if (!passed) process.exitCode = 1
