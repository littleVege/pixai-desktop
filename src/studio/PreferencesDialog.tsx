import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { reportError } from './Notices'
import { studio, type StudioEntity } from './api'

export function PreferencesPanel({ preferences, onChange }: { preferences: StudioEntity[]; onChange: () => Promise<void> }) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<string>()
  const [busy, setBusy] = useState(false)
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true)
    try { await action(); await onChange() }
    catch (e) { reportError(e) }
    finally { setBusy(false) }
  }
  return <section className="settings-panel"><h3>创作偏好</h3><p className="text-muted-foreground">用于所有作品的 Prompt 强化和 Agent 创作。当前作品的明确要求和锁定内容优先。</p>
    <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void mutate(async () => { await studio.savePreference({ text, id: editing }); setText(''); setEditing(undefined) }) }}>
      <label htmlFor="creative-preference" className="text-sm font-medium">{editing ? '修改偏好' : '添加偏好'}</label>
      <Textarea id="creative-preference" placeholder="例如：偏好柔和光线与低饱和冷色调" value={text} maxLength={2000} onChange={e => setText(e.target.value)} required />
      <div className="flex gap-2"><Button type="submit" disabled={busy || !text.trim()}>确认保存并用于后续创作</Button>{editing && <Button type="button" variant="ghost" onClick={() => { setEditing(undefined); setText('') }}>取消修改</Button>}</div>
    </form>
    {!preferences.length && <p className="py-4 text-sm text-muted-foreground">尚未保存偏好。当前作品的对话不会自动成为长期偏好。</p>}
    <ul className="divide-y">{preferences.map(item => <li key={item.id} className="flex flex-col gap-3 py-4">
      <p className={`whitespace-pre-wrap text-sm ${item.data.active ? '' : 'text-muted-foreground'}`}>{item.data.text}</p>
      <div className="flex items-center gap-2"><span className="mr-auto text-xs text-muted-foreground">{item.data.active ? '用于后续创作' : '已停用'}</span>
        <Button variant="ghost" disabled={busy} onClick={() => { setEditing(item.id); setText(item.data.text) }}>修改</Button>
        <Button variant="outline" disabled={busy} onClick={() => void mutate(() => studio.setPreferenceActive({ id: item.id, active: !item.data.active }))}>{item.data.active ? '停用' : '恢复使用'}</Button>
      </div>
    </li>)}</ul>
  </section>
}
