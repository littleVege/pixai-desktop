import { app, safeStorage, shell, net } from 'electron'
import OpenAI from 'openai'
import { join } from 'node:path'
import { createChatGPT } from './vendor/siwc/index'

export const chatgpt = createChatGPT({
  appId: 'pixai-desktop', appName: 'PixAI Desktop', redirectPort: 0, sendHostId: true,
  storageDir: join(app.getPath('userData'), 'chatgpt'),
  credentialEncryption: {
    id: 'electron-safe-storage-v1', isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: value => safeStorage.encryptString(value), decrypt: bytes => safeStorage.decryptString(Buffer.from(bytes)),
  },
  openBrowser: async url => {
    if (new URL(url).origin !== 'https://auth.openai.com') throw new Error('授权地址无效')
    await shell.openExternal(url)
  },
})

export function planResponse(body: Record<string, any>, signal: AbortSignal, onEvent: (event: unknown) => void) {
  return chatgpt.authenticatedRequest(async (token, sessionSignal) => {
    const client = new OpenAI({ apiKey: token, baseURL: 'https://api.openai.com/v1', organization: null, project: null,
      fetch: (input, init) => net.fetch(input instanceof URL ? input.href : input, init), maxRetries: 0, logLevel: 'off', fetchOptions: { redirect: 'error' },
      defaultHeaders: { authorization: 'Bearer ' + token, 'openai-organization': null, 'openai-project': null } })
    const input = body.input.map((item: Record<string, unknown>) => item.role === 'system' ? { ...item, role: 'developer' } : item)
    if (body.tools?.length) input.unshift({ type: 'additional_tools', role: 'developer', tools: body.tools })
    const stream = await client.responses.create({ model: body.model, input, instructions: body.instructions,
      text: body.text, tool_choice: body.tool_choice, stream: true, store: false }, { signal: sessionSignal })
    for await (const event of stream) {
      if (body.stream) onEvent(event)
      if (event.type === 'response.completed') return event.response
      if (event.type === 'response.failed' || event.type === 'response.incomplete' || event.type === 'error') throw new Error('ChatGPT 未完成本次请求')
    }
    throw new Error('ChatGPT 响应流提前结束')
  }, signal)
}
