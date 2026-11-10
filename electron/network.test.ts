import { afterEach, describe, expect, it, vi } from 'vitest'
import { installSystemNetwork } from './network'
const network = vi.hoisted(() => ({ fetch: vi.fn(), proxies: [] as string[] }))
vi.mock('undici', () => ({
  fetch: network.fetch,
  ProxyAgent: class { constructor(readonly uri: string) { network.proxies.push(uri) } },
}))
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); network.proxies.length = 0 })
describe('Electron system network transport', () => {
  it('uses the matching fetch implementation for proxy dispatch and preserves native Request content', async () => {
    const native = vi.fn()
    vi.stubGlobal('fetch', native)
    const resolve = vi.fn().mockResolvedValue('PROXY 127.0.0.1:8123; DIRECT')
    network.fetch.mockResolvedValue(new Response('ok'))
    installSystemNetwork(resolve)
    const abort = new AbortController()
    const request = new Request('https://service.example/v1/chat?private=value', { method: 'POST', headers: { Authorization: 'Bearer test-only', 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'hello' }), signal: abort.signal })
    expect(await (await fetch(request)).text()).toBe('ok')
    expect(native).not.toHaveBeenCalled()
    expect(resolve).toHaveBeenCalledWith('https://service.example')
    const [url, init] = network.fetch.mock.calls[0]
    expect(url).toBe(request.url)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-only')
    expect(await new Response(init.body).text()).toBe('{"prompt":"hello"}')
    expect(init.dispatcher.uri).toBe('http://127.0.0.1:8123')
    abort.abort()
    expect(init.signal.aborted).toBe(true)
  })
  it('caches the origin decision and proxy instead of resolving per request', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const resolve = vi.fn().mockResolvedValue('HTTPS proxy.example:443')
    network.fetch.mockImplementation(async () => new Response('ok'))
    installSystemNetwork(resolve)
    await fetch('https://service.example/a')
    await fetch('https://service.example/b')
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(network.proxies).toEqual(['https://proxy.example:443'])
  })
  it('does not silently bypass an unsupported proxy', async () => {
    vi.stubGlobal('fetch', vi.fn())
    installSystemNetwork(async () => 'SOCKS5 localhost:1080')
    await expect(fetch('https://service.example')).rejects.toThrow('代理协议不受支持')
    expect(network.fetch).not.toHaveBeenCalled()
  })
})
