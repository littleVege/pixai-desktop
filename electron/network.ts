import { ProxyAgent, fetch as transportFetch, type Dispatcher } from 'undici'

/** Resolve system proxy per origin through Electron; never forward credentials to the resolver. */
export function installSystemNetwork(resolveProxy: (url: string) => Promise<string>) {
  const nativeFetch = globalThis.fetch
  const agents = new Map<string, Dispatcher>()
  const decisions = new Map<string, { value: string; expires: number }>()
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (!['http:', 'https:'].includes(url.protocol)) return nativeFetch(input, init)
    let decision = decisions.get(url.origin)
    if (!decision || decision.expires < Date.now()) {
      decision = { value: await resolveProxy(url.origin), expires: Date.now() + 60_000 }
      decisions.set(url.origin, decision)
    }
    const first = decision.value.split(';')[0].trim()
    const match = /^(PROXY|HTTPS)\s+(.+)$/i.exec(first)
    let dispatcher: Dispatcher | undefined
    if (match) {
      const proxy = `${match[1].toUpperCase() === 'HTTPS' ? 'https' : 'http'}://${match[2]}`
      if (!agents.has(proxy)) agents.set(proxy, new ProxyAgent(proxy))
      dispatcher = agents.get(proxy)
    } else if (first && first !== 'DIRECT') throw new Error('当前系统代理协议不受支持，请配置 HTTP/HTTPS 代理')
    // Electron's bundled fetch may use a different Undici dispatcher contract.
    // Keep fetch and ProxyAgent from the same installed version, and normalize
    // native Request instances rather than passing them across implementations.
    const request = new Request(input, init)
    return transportFetch(request.url, {
      method: request.method,
      headers: Array.from(request.headers.entries()),
      body: request.body,
      signal: request.signal,
      redirect: request.redirect,
      duplex: 'half',
      dispatcher,
    }) as unknown as Promise<Response>
  }
}
