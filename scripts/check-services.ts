import { generateText, Output } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'

const redact = (value: string) => [process.env.PIXAI_API_KEY, process.env.LLM_MODEL_API_KEY].filter(Boolean).reduce((text, key) => text.replaceAll(key!, '[redacted]'), value)
const results = await Promise.allSettled([
  (async () => {
    const response = await fetch('https://api.pixai.art/v2/generation-model/search?usageType=MODEL&size=1', { headers: { Authorization: `Bearer ${process.env.PIXAI_API_KEY}` }, signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`PixAI directory HTTP ${response.status}`)
    const result = await response.json() as { data: unknown[] }
    return { service: 'PixAI directory', records: result.data.length }
  })(),
  (async () => {
    const provider = createOpenAICompatible({ name: 'configured', baseURL: process.env.LLM_MODEL_BASE_URL!, apiKey: process.env.LLM_MODEL_API_KEY! })
    const result = await generateText({ model: provider(process.env.LLM_MODEL_NAME!), maxRetries: 0, abortSignal: AbortSignal.timeout(60_000), output: Output.object({ schema: z.object({ prompt: z.string(), preserved: z.boolean() }) }), prompt: 'Return a JSON object. Improve this anime illustration prompt while preserving the content: adult silver-haired swordswoman at a rainy train station. Return a concise English prompt and preserved=true if the required details remain.' })
    return { service: 'LLM structured prompt enhancement', valid: !!result.output.prompt && result.output.preserved, outputCharacters: result.output.prompt.length }
  })(),
])
for (const result of results) console.log(result.status === 'fulfilled' ? result.value : { error: redact(result.reason instanceof Error ? result.reason.message : String(result.reason)), cause: result.reason?.cause?.code ?? result.reason?.cause?.message })
if (results.some(result => result.status === 'rejected')) process.exitCode = 1
