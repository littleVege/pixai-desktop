import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { checkModelCapabilities } from '../electron/model-capabilities'
const redact = (message: string) => [process.env.LLM_MODEL_API_KEY, process.env.VISION_MODEL_API_KEY].filter(Boolean).reduce((text, key) => text.replaceAll(key!, '[redacted]'), message)
const results = await checkModelCapabilities(vision => {
  const provider = createOpenAICompatible({ name: 'configured', baseURL: vision && process.env.VISION_MODEL_BASE_URL ? process.env.VISION_MODEL_BASE_URL : process.env.LLM_MODEL_BASE_URL!, apiKey: vision && process.env.VISION_MODEL_API_KEY ? process.env.VISION_MODEL_API_KEY : process.env.LLM_MODEL_API_KEY! })
  return provider(vision && process.env.VISION_MODEL_NAME ? process.env.VISION_MODEL_NAME : process.env.LLM_MODEL_NAME!)
}, redact)
for (const result of results) console.log(JSON.stringify(result))
if (results.some(result => !result.ok)) process.exitCode = 1
