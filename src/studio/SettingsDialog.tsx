import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PreferencesPanel } from './PreferencesDialog'
import { reportError } from './Notices'
import { studio, type StudioEntity } from './api'

export function SettingsDialog({ open, onClose, preferences, onChange }: { preferences: StudioEntity[]; onChange: () => Promise<void>; open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ pixaiKey: '', llmKey: '', llmBaseUrl: '', llmModel: '', visionBaseUrl: '', visionModel: '', visionKey: '' })
  const [service, setService] = useState('apiKey')
  const [planModel, setPlanModel] = useState('')
  const [account, setAccount] = useState<Awaited<ReturnType<typeof studio.chatgptLogin>>>()
  const [models, setModels] = useState<Awaited<ReturnType<typeof studio.chatgptModels>>>([])
  const [loggingIn, setLoggingIn] = useState(false)
  useEffect(() => {
    if (!open || service !== 'chatgpt' || !account?.sharing) return
    let live = true
    void studio.chatgptModels().then(items => {
      if (!live) return
      setModels(items)
      setPlanModel(old => items.some(item => item.slug === old) ? old : items[0]?.slug ?? '')
    }).catch(error => { if (live) reportError(error) })
    return () => { live = false }
  }, [open, service, account])
  async function login() {
    setLoggingIn(true)
    try { setAccount(await studio.chatgptLogin()) } catch (error) { reportError(error) }
    finally { setLoggingIn(false) }
  }
  const [configured, setConfigured] = useState({ pixai: false, llm: false })
  const [section, setSection] = useState('services')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [capabilities, setCapabilities] = useState<Awaited<ReturnType<typeof studio.checkCapabilities>>>([])
  useEffect(() => {
    if (open) void studio.settings().then(settings => {
      setService(settings.modelService)
      setPlanModel(settings.chatgptModel)
      setAccount(settings.chatgptSession)
      setForm({ pixaiKey: '', llmKey: '', llmBaseUrl: settings.llmBaseUrl, llmModel: settings.llmModel, visionBaseUrl: settings.visionBaseUrl, visionModel: settings.visionModel, visionKey: '' })
      setConfigured({ pixai: settings.pixaiConfigured, llm: settings.llmConfigured })
    }).catch(reportError)
  }, [open])
  async function check() {
    setChecking(true); setCapabilities([])
    try { setCapabilities(await studio.checkCapabilities()) }
    catch (e) { reportError(e) }
    finally { setChecking(false) }
  }
  async function save() {
    setSaving(true); setCapabilities([])
    try {
      if (service === 'apiKey' && !['https:', 'http:'].includes(new URL(form.llmBaseUrl).protocol)) throw new Error('请输入有效的模型服务地址')
      await studio.saveSettings({ modelService: service, chatgptModel: planModel, llmBaseUrl: form.llmBaseUrl, llmModel: form.llmModel, visionBaseUrl: form.visionBaseUrl, visionModel: form.visionModel, ...(form.visionKey ? { visionKey: form.visionKey } : {}), ...(form.pixaiKey ? { pixaiKey: form.pixaiKey } : {}), ...(form.llmKey ? { llmKey: form.llmKey } : {}) })
      onClose()
    } catch (e) { reportError(e) } finally { setSaving(false) }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="settings-dialog sm:max-w-[min(860px,92vw)]"><DialogHeader><DialogTitle>设置</DialogTitle><DialogDescription>管理此 Mac 上的模型服务与创作偏好。</DialogDescription></DialogHeader>
    <div className="settings-layout"><nav aria-label="设置分组">{[['services', '模型服务'], ['preferences', '创作偏好']].map(([id, title]) => <button key={id} aria-pressed={section === id} onClick={() => setSection(id)}>{title}</button>)}</nav><div className="settings-body">
    {section === 'preferences' ? <PreferencesPanel preferences={preferences} onChange={onChange} /> :
    <form className="flex flex-col gap-5" onSubmit={e => { e.preventDefault(); void save() }}>
      <fieldset><legend>PixAI 图像生成</legend><label className="flex flex-col gap-2">PixAI API Key<Input type="password" autoComplete="off" value={form.pixaiKey} placeholder={configured.pixai ? '已配置，留空保留' : '输入 PixAI API Key'} onChange={e => setForm({ ...form, pixaiKey: e.target.value })} /></label>
      </fieldset><fieldset><legend>语言模型</legend>
      <label>连接方式 <select value={service} onChange={e => setService(e.target.value)}><option value="apiKey">API Key</option><option value="chatgpt">ChatGPT 套餐</option></select></label>
      {service === 'chatgpt' ? <>
        <p>{account?.sharing ? '已授权使用 ChatGPT 套餐' : '通过浏览器授权使用 ChatGPT 套餐额度'}</p>
        {account?.sharing ? <>
          <label>ChatGPT 模型 <select required value={planModel} onChange={e => setPlanModel(e.target.value)}>
            {!models.length && <option value={planModel}>{planModel || '等待模型列表'}</option>}
            {models.map(model => <option key={model.slug} value={model.slug}>{model.displayName}</option>)}
          </select></label>
          <Button type="button" variant="outline" onClick={() => void studio.chatgptUsage().catch(reportError)}>管理套餐用量</Button>
        </> : <Button type="button" disabled={loggingIn} onClick={() => void login()}>{loggingIn ? '等待浏览器授权…' : 'Continue with ChatGPT'}</Button>}
        {loggingIn && <Button type="button" variant="ghost" onClick={() => void studio.chatgptCancel().catch(reportError)}>取消登录</Button>}
        {account?.status === 'connected' && <Button type="button" variant="ghost" onClick={() => void studio.chatgptLogout().finally(() => studio.settings().then(s => setAccount(s.chatgptSession))).catch(reportError)}>断开 ChatGPT 连接</Button>}
      </> : <><label className="flex flex-col gap-2">模型服务地址<Input type="url" value={form.llmBaseUrl} placeholder="https://…/v1" onChange={e => setForm({ ...form, llmBaseUrl: e.target.value })} required /></label>
      <label className="flex flex-col gap-2">模型名称<Input value={form.llmModel} onChange={e => setForm({ ...form, llmModel: e.target.value })} required /></label>
      <label className="flex flex-col gap-2">模型 API Key<Input type="password" autoComplete="off" value={form.llmKey} placeholder={configured.llm ? '已配置，留空保留' : '输入模型服务 API Key'} onChange={e => setForm({ ...form, llmKey: e.target.value })} /></label>
      </>}</fieldset><fieldset><legend>独立视觉服务 · 可选</legend><label className="flex flex-col gap-2">视觉模型（留空共用语言模型）<Input value={form.visionModel} onChange={e => setForm({ ...form, visionModel: e.target.value })} /></label>
      <label className="flex flex-col gap-2">视觉服务地址<Input value={form.visionBaseUrl} onChange={e => setForm({ ...form, visionBaseUrl: e.target.value })} /></label>
      <label className="flex flex-col gap-2">视觉服务 Key<Input type="password" autoComplete="off" value={form.visionKey} placeholder="留空保留或共用语言服务凭证" onChange={e => setForm({ ...form, visionKey: e.target.value })} /></label>
      </fieldset><div className="flex flex-col gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={checking || saving} onClick={() => void check()}>{checking ? '正在检测…' : '检测已保存配置的能力'}</Button>
        <p className="text-xs text-muted-foreground">向已保存的服务发送三次小型模型请求，测试结构化输出、工具调用和测试图片识别；可能消耗模型额度。</p>
        <ul className="space-y-2 text-sm" aria-live="polite">{capabilities.map(result => <li key={result.capability}><strong>{({ structured: '结构化输出', tools: '工具调用', vision: '图像输入' })[result.capability]}：{result.ok ? '通过' : '未通过'}</strong><p className="break-words text-xs text-muted-foreground">{result.detail}</p></li>)}</ul>
      </div>
      <Button type="submit" disabled={saving}>{saving ? '正在保存…' : '保存配置'}</Button>
    </form>}</div></div>
  </DialogContent></Dialog>
}
