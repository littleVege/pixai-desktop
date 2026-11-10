import { generateText, Output, tool, type LanguageModel } from 'ai'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { visionProbe } from './vision-probe'

export interface CapabilityResult { capability: 'structured' | 'tools' | 'vision'; ok: boolean; detail: string }
export async function checkModelCapabilities(model: (vision: boolean) => LanguageModel, redact: (message: string) => string = value => value): Promise<CapabilityResult[]> {
  async function check(capability: CapabilityResult['capability'], action: () => Promise<void>, detail: string): Promise<CapabilityResult> {
    try { await action(); return { capability, ok: true, detail } }
    catch (error) { return { capability, ok: false, detail: redact(error instanceof Error ? error.message : '能力检测失败').slice(0, 500) } }
  }
  return Promise.all([
    check('structured', async () => {
      const token = randomUUID()
      const result = await generateText({ model: model(false), maxRetries: 0, maxOutputTokens: 200, abortSignal: AbortSignal.timeout(45_000), output: Output.object({ schema: z.object({ value: z.string() }) }), prompt: `Return JSON with the field value exactly equal to ${JSON.stringify(token)}.` })
      if (result.output.value !== token) throw new Error('结构化结果没有保留指定字段值')
    }, '结构化输出通过'),
    check('tools', async () => {
      const token = randomUUID()
      const result = await generateText({ model: model(false), maxRetries: 0, maxOutputTokens: 200, abortSignal: AbortSignal.timeout(45_000), toolChoice: 'auto', tools: { echo: tool({ description: 'Return the supplied value unchanged', inputSchema: z.object({ value: z.string() }), execute: async ({ value }) => ({ value }) }) }, prompt: `Call echo with value exactly ${JSON.stringify(token)}.` })
      if (!result.toolResults.some(item => item.toolName === 'echo' && z.object({ value: z.string() }).safeParse(item.output).data?.value === token)) throw new Error('模型未完成符合参数约束的工具调用')
    }, '工具调用与参数解析通过'),
    check('vision', async () => {
      const color = z.enum(['red', 'blue', 'green', 'yellow', 'black', 'white', 'other'])
      const result = await generateText({ model: model(true), maxRetries: 0, maxOutputTokens: 200, abortSignal: AbortSignal.timeout(45_000), output: Output.object({ schema: z.object({ left: color, right: color }) }), messages: [{ role: 'user', content: [{ type: 'text', text: 'Inspect this image. Return JSON containing the predominant colors of the left half and the right half. Use the fields left and right.' }, { type: 'file', data: visionProbe, mediaType: 'image/png' }] }] })
      if (result.output.left !== 'red' || result.output.right !== 'blue') throw new Error('图像输入未得到正确的基础识别结果')
    }, '基础图像输入与识别通过；二次元评价质量仍需实际作品验证'),
  ])
}
