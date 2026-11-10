import { useCallback, useEffect, useRef, useState } from 'react'
import { Ellipsis, Plus, Settings, Sparkles, ImageIcon, Bookmark, PanelRight, ChevronDown, PencilLine, Settings2, Undo2 } from 'lucide-react'
import { Composer } from '@/components/composer/Composer'
import { Button } from '@/components/ui/button'
import { useComposerStore, selectState, EMPTY_DOC, defaultParams, newComposerDraft } from '@/store/composerStore'
import { findModel, rememberRecipes, presets, generations, uploads } from '@/mock/data'
import { docToPrompt, promptToDoc } from '@/lib/promptSerialize'
import type { ComposerState, ComposerSubmission } from '@/types'
import { studio, assetUrl, type StudioSnapshot, type PromptSuggestion, type StudioEntity } from './api'
import './studio.css'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SettingsDialog } from './SettingsDialog'
import { ImageWorkspace } from './ImageWorkspace'
import { ResultGallery } from './ResultGallery'
import { rebaseParams } from '@/lib/params'
import { WorkSearch } from './WorkSearch'
import { WorkTitle } from './WorkTitle'
import { Notices, reportError as report } from './Notices'
import { ConversationTimeline } from './ConversationTimeline'
import { currentDraft, persistReferences } from './drafts'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'

const emptyLocks: string[] = []
const empty: StudioSnapshot = { works: [], revisions: [], jobs: [], assets: [], runs: [], messages: [], presets: [], preferences: [] }
export default function StudioApp() {
  const [data, setData] = useState(empty)
  const [workId, setWorkId] = useState<string>()
  type Shelf = 'active' | 'archived' | 'deleted'
  const [shelf, setShelf] = useState<Shelf>('active')
  const shelfTitles = { active: '作品', archived: '已归档', deleted: '最近删除' }
  const [mode, setMode] = useState<'manual' | 'agent'>('agent')
  const [panelOpen, setPanelOpen] = useState(false)
  const [preview, setPreview] = useState<string[]>([])
  const [settings, setSettings] = useState(false)
  const [busy, setBusy] = useState(false)
  const [maxImages, setMaxImages] = useState(6)
  const [maxCalls, setMaxCalls] = useState(20)
  const locks = useComposerStore(state => state.lockedContents ?? emptyLocks)
  const [candidate, setCandidate] = useState<PromptSuggestion & { baseline: string }>()
  const [undoPrompt, setUndoPrompt] = useState<{ before: ComposerState['doc']; applied: string }>()
  const current = useRef<{ id?: string; revision: number; edits: number; saveError?: unknown; loading: boolean }>({ revision: 0, edits: 0, loading: false })
  const saveChain = useRef(Promise.resolve())
  const promptAction = useRef<'accept' | 'undo' | undefined>(undefined)
  const refreshSequence = useRef(0)
  const navigationSequence = useRef(0)
  const work = data.works.find(item => item.id === workId)
  const shelfWorks = data.works.filter(item => (item.data.libraryState ?? 'active') === shelf)
  const resultAssets = data.assets.filter(asset => asset.data.source === 'generation')
  const applySnapshot = useCallback((next: StudioSnapshot) => {
    presets.splice(0, presets.length, ...next.presets.map(p => ({ id: p.id, title: p.data.title, prompt: docToPrompt(p.data.snapshot.doc, p.data.snapshot.references), modelVersionId: p.data.snapshot.modelVersionId, params: p.data.snapshot.params, snapshot: p.data.snapshot })))
    for (const [collection, source] of [[generations, 'generation'], [uploads, 'upload']] as const) collection.splice(0, collection.length, ...next.assets.filter(a => a.data.source === source).map(a => ({ id: a.id, mediaId: a.data.mediaId ?? '', url: assetUrl(a.data.filename), w: a.data.width ?? 0, h: a.data.height ?? 0, source, createdAt: a.createdAt })))
    setData(next)
  }, [])
  const refresh = useCallback(async () => {
    if (!studio) return
    const id = current.current.id
    const sequence = ++refreshSequence.current
    try {
      const next = await studio.snapshot({ workId: id })
      if (sequence === refreshSequence.current && id === current.current.id) applySnapshot(next)
    } catch (e) { if (sequence === refreshSequence.current) report(e) }
  }, [applySnapshot])
  useEffect(() => { void refresh(); if (studio) return studio.onChange(() => void refresh()) }, [refresh])
  useEffect(() => {
    return useComposerStore.subscribe((state, previous) => {
      const draft = currentDraft()
      const action = promptAction.current
      promptAction.current = undefined
      if (!current.current.id || current.current.loading || (!action && JSON.stringify(selectState(state)) === JSON.stringify(selectState(previous)))) return
      const owner = current.current
      owner.edits++
      const id = current.current.id
      saveChain.current = saveChain.current.then(async () => {
        const persisted = await persistReferences(draft, id)
        const saved = await studio.saveDraft({ workId: id, draft: persisted, expectedRevision: owner.revision, promptAction: action })
        owner.revision = saved.data.draftRevision
        owner.saveError = undefined
        if (owner !== current.current) return
        if (JSON.stringify(selectState(useComposerStore.getState())) === JSON.stringify(selectState(state))) {
          current.current.loading = true
          useComposerStore.setState({ references: persisted.references })
          current.current.loading = false
        }
      }).catch(error => { owner.saveError = error; report(error) })
    })
  }, [])
  async function openWork(item: StudioEntity, navigation = ++navigationSequence.current) {
    await saveChain.current
    const latest = await studio.snapshot({ workId: item.id })
    if (navigation !== navigationSequence.current) return
    item = latest.works.find(w => w.id === item.id) ?? item
    current.current.loading = true
    rememberRecipes(item.data.draft?.recipeMetadata ?? [])
    useReferenceSceneStore.setState({ scenes: item.data.draft?.scenes ?? {}, dialog: null })
    const saved = item.data.draft
    if (saved) {
      const defaults = newComposerDraft()
      useComposerStore.setState({
        ...defaults, ...saved,
        modelVersionId: saved.modelVersionId || defaults.modelVersionId,
        params: !saved.params ? defaults.params : saved.modelVersionId ? saved.params : rebaseParams(saved.params, defaultParams(''), defaults.params),
        docRevision: useComposerStore.getState().docRevision + 1,
      })
    } else useComposerStore.getState().reset()
    current.current = { id: item.id, revision: item.data.draftRevision ?? 0, edits: 0, loading: false }
    ++refreshSequence.current
    applySnapshot(latest)
    setPanelOpen(false); setPreview([])
    setWorkId(item.id); setCandidate(undefined); setUndoPrompt(undefined)
  }
  async function moveWork(item: StudioEntity, target: Shelf) {
    await saveChain.current
    if (item.id === current.current.id && current.current.saveError) throw current.current.saveError
    await studio.moveWork({ workId: item.id, libraryState: target })
    if (item.id === current.current.id) {
      ++navigationSequence.current
      current.current = { revision: 0, edits: 0, loading: false }
      setWorkId(undefined); setCandidate(undefined); setUndoPrompt(undefined); setPreview([])
    }
    await refresh()
  }
  async function createWork() {
    const navigation = ++navigationSequence.current
    try {
      await saveChain.current
      const item = await studio.createWork({ title: '新的创作', draft: newComposerDraft() })
      if (navigation === navigationSequence.current) { setShelf('active') }
      await openWork(item, navigation)
    } catch (e) { current.current.loading = false; report(e) }
  }
  async function submitPrompt(send: (revision: number) => Promise<{ cleared: boolean }>) {
    const owner = current.current
    const edits = owner.edits
    const result = await send(owner.revision)
    if (result.cleared && owner === current.current && owner.edits === edits) {
      owner.loading = true
      try {
        useComposerStore.setState(state => ({ doc: EMPTY_DOC, docRevision: state.docRevision + 1 }))
        setCandidate(undefined)
        setUndoPrompt(undefined)
      } finally { owner.loading = false }
    }
  }
  async function generate(submission: ComposerSubmission) {
    if (!workId) return
    setBusy(true)
    try {
      await waitForDraft()
      if (!submission.modelVersionId) throw new Error('请选择模型，或让 Agent 为你查找合适的模型')
      if (current.current.id !== workId) return
      const snapshot = currentDraft()
      const modelType = findModel(submission.modelVersionId)?.type ?? (snapshot.promptContext.model?.versionId === submission.modelVersionId ? snapshot.promptContext.model.type : undefined)
      if (!modelType) throw new Error('无法确认模型类型，请在目录中重新选择模型')
      await submitPrompt(submittedRevision => studio.generate({ workId, submittedRevision, request: { ...submission, modelType }, snapshot }))
      await refresh()
    } catch (e) { report(e) } finally { setBusy(false) }
  }
  async function waitForDraft() {
    const owner = current.current
    const edits = owner.edits
    await saveChain.current
    if (owner !== current.current || owner.edits !== edits) throw new Error('当前作品或草稿已改变，请按最新内容重新操作。')
    if (owner.saveError) throw owner.saveError
  }
  async function saveCurrentPreset(title: string) {
    if (!workId) return
    setBusy(true)
    try {
      await saveChain.current
      if (current.current.id !== workId) return
      const snapshot = await persistReferences(currentDraft(), workId)
      await studio.savePreset({ title, snapshot })
      await refresh()
    } catch (e) { report(e) } finally { setBusy(false) }
  }
  async function enhance() {
    setBusy(true)
    try {
      await waitForDraft()
      if (current.current.id !== workId) return
      const state = selectState(useComposerStore.getState())
      const result = await studio.enhancePrompt({ workId, prompt: docToPrompt(state.doc, state.references), snapshot: currentDraft() })
      if (current.current.id !== workId) return
      setCandidate({ ...result, baseline: JSON.stringify(state) })
    } catch (e) { report(e) } finally { setBusy(false) }
  }
  function acceptCandidate() {
    if (!candidate) return
    const state = selectState(useComposerStore.getState())
    if (JSON.stringify(state) !== candidate.baseline) {
      report('草稿在强化期间发生了修改，请重新强化后再接受，避免覆盖新内容。')
      return
    }
    const doc = promptToDoc(candidate.prompt, state.references)
    setUndoPrompt({ before: structuredClone(state.doc), applied: JSON.stringify(doc) })
    promptAction.current = 'accept'
    useComposerStore.setState({ doc, docRevision: useComposerStore.getState().docRevision + 1 })
    setCandidate(undefined)
  }
  function undoEnhancement() {
    if (!undoPrompt) return
    if (JSON.stringify(useComposerStore.getState().doc) !== undoPrompt.applied) {
      report('接受强化后又编辑了 Prompt，无法直接撤销以免覆盖新内容。可使用编辑器撤销。')
      return
    }
    promptAction.current = 'undo'
    useComposerStore.setState({ doc: undoPrompt.before, docRevision: useComposerStore.getState().docRevision + 1 })
    setUndoPrompt(undefined)
  }
  async function restoreRevision(revisionId: string, assetId: string) {
    if (!workId) return
    setBusy(true)
    const navigation = ++navigationSequence.current
    try {
      await saveChain.current
      if (current.current.id !== workId || navigation !== navigationSequence.current) return
      const restored = await studio.restoreRevision({ workId, revisionId, assetId, expectedRevision: current.current.revision })
      await openWork(restored, navigation)
      await refresh()
    } catch (e) { report(e) } finally { setBusy(false) }
  }
  async function startAgent(submission: ComposerSubmission) {
    if (!workId || !submission.prompt.trim()) return
    setBusy(true)
    try {
      await waitForDraft()
      if (current.current.id !== workId) return
      await submitPrompt(submittedRevision => studio.startAgent({ workId, submittedRevision, goal: submission.prompt, maxImages, maxModelCalls: maxCalls, snapshot: currentDraft() }))
      await refresh()
    } catch (e) { report(e) } finally { setBusy(false) }
  }
  if (!studio) return <main className="studio-unavailable"><h1>PixAI Desktop</h1><p>请从 Electron 启动客户端以连接本地作品库。</p></main>
  return <div className="studio-app">
    <div className="studio-titlebar">PixAI Desktop</div>
    <div className="studio-layout">
      <aside className="studio-sidebar">
        <div className="studio-brand"><Sparkles />PixAI</div>
        <Button onClick={() => void createWork()}><Plus data-icon="inline-start" />新建作品</Button>
        <div className="works-heading"><DropdownMenu><DropdownMenuTrigger asChild><button className="library-picker" aria-label={'作品列表：' + shelfTitles[shelf]}>{shelfTitles[shelf]} <ChevronDown size={14}/></button></DropdownMenuTrigger><DropdownMenuContent align="start">{(Object.keys(shelfTitles) as Shelf[]).map(id => <DropdownMenuItem key={id} onSelect={() => setShelf(id)}>{shelfTitles[id]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
          <WorkSearch works={shelfWorks} shelfTitle={shelfTitles[shelf]} deleted={shelf === 'deleted'}
            onChoose={item => shelf === 'deleted' ? moveWork(item, 'active') : openWork(item)} />
        </div>
        <nav>{shelfWorks.map(item =>
          <div key={item.id} className="library-row"><button disabled={shelf === 'deleted'} className={`work-row ${item.id === workId ? 'selected' : ''}`} onClick={() => void openWork(item).catch(report)}>
            {item.data.coverFilename ? <img className="work-cover" src={assetUrl(item.data.coverFilename, true)} alt="" loading="lazy" /> : <ImageIcon />}
            <span>{item.data.title}<small>{item.data.versionCount > 0 && `${item.data.versionCount} 个版本 · `}{new Date(item.updatedAt).toLocaleDateString()}</small></span>
          </button><DropdownMenu><DropdownMenuTrigger asChild><Button className="work-actions" size="icon-sm" variant="ghost" aria-label={item.data.title + '的操作'}><Ellipsis /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuItem disabled={busy} onSelect={() => void moveWork(item, shelf === 'active' ? 'archived' : 'active').catch(report)}>{shelf === 'active' ? '归档作品' : '恢复到作品列表'}</DropdownMenuItem>
              {shelf !== 'deleted' && <DropdownMenuItem disabled={busy} onSelect={() => void moveWork(item, 'deleted').catch(report)}>移入最近删除</DropdownMenuItem>}
            </DropdownMenuContent></DropdownMenu></div>)}
            {!shelfWorks.length && <p className="library-empty">{shelf === 'archived' ? '还没有归档的作品' : shelf === 'deleted' ? '没有已删除的作品' : '还没有作品'}</p>}</nav>
        <Button className="justify-start" variant="ghost" onClick={() => setSettings(true)}><Settings data-icon="inline-start" />设置</Button>
      </aside>
      <main className="studio-workspace">
        <header>{work ? <WorkTitle key={work.id} work={work} onChange={refresh} onError={report} /> : <h1>开始新的创作</h1>}
          {work && <Button variant="ghost" size="icon" aria-expanded={panelOpen} aria-controls="image-workspace" aria-label="图片工作区" title="图片工作区"
            onClick={() => { setPreview([]); setPanelOpen(value => !value) }}><PanelRight /></Button>}
        </header>
        <div className="workspace-panes"><div className="conversation-pane">
        <section className="studio-results conversation-workspace">
          {workId ? <ConversationTimeline key={workId} data={data} onChange={refresh}
            onResume={async id => { await waitForDraft(); await studio.continueAgent({ runId: id }) }}
            onError={report} onPreview={asset => { setPreview([asset.id]); setPanelOpen(true) }} /> : <div className="studio-empty"><ImageIcon /><h2>你的创作，从这里开始</h2><Button onClick={() => void createWork()}>新建作品</Button></div>}
        </section>
        {workId && <section className="studio-composer" aria-label="创作输入">
          <Composer key={workId} agentMode={mode === 'agent'} disabled={busy}
            onSubmit={mode === 'agent' ? startAgent : generate}
            promptHistory={data.revisions.map(r => r.data.request?.prompt).filter(Boolean)}
            actions={<>
              <DropdownMenu><DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="composer-mode" aria-label="选择创作方式">{mode === 'agent' ? <Sparkles /> : <ImageIcon />}{mode === 'agent' ? 'Agent' : '直接生成'}<ChevronDown /></Button>
              </DropdownMenuTrigger><DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onSelect={() => setMode('agent')}><Sparkles />交给 Agent</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setMode('manual')}><ImageIcon />直接生成</DropdownMenuItem>
              </DropdownMenuContent></DropdownMenu>
              <Button size="sm" variant="ghost" title="强化 Prompt" disabled={busy} onClick={() => void enhance()}><PencilLine />强化 Prompt</Button>
              {undoPrompt && <Button size="icon" variant="ghost" aria-label="撤销上次强化" title="撤销上次强化" onClick={undoEnhancement}><Undo2 /></Button>}
              <Popover><PopoverTrigger asChild><Button size="icon" variant="ghost" aria-label="创作设置" title="创作设置"><Settings2 /></Button></PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-72 gap-4 p-4">
                  {mode === 'agent' && <fieldset className="grid grid-cols-2 gap-2"><legend className="mb-2 font-medium">执行额度</legend>
                    <label className="composer-setting">生成张数上限<input title="设为 0 时只给建议" type="number" min={0} max={24} value={maxImages} onChange={e => setMaxImages(Number(e.target.value))} /></label>
                    <label className="composer-setting">模型调用上限<input type="number" min={1} max={100} value={maxCalls} onChange={e => setMaxCalls(Number(e.target.value))} /></label>
                  </fieldset>}
                  <label className="composer-setting">锁定要求<textarea rows={3} placeholder="每行写一个必须保留的要求" value={locks.join('\n')} onChange={e => useComposerStore.setState({ lockedContents: e.target.value.split('\n') })} /></label>
                  <form className="grid gap-2" onSubmit={event => {
                    event.preventDefault()
                    const title = String(new FormData(event.currentTarget).get('title') ?? '').trim()
                    if (title) void saveCurrentPreset(title)
                  }}>
                    <label className="composer-setting">预设名称<input name="title" defaultValue={work?.data.title ?? '生成预设'} required maxLength={200} /></label>
                    <Button type="submit" variant="outline" disabled={busy}><Bookmark />保存当前预设</Button>
                  </form>
                </PopoverContent>
              </Popover>
            </>}
            review={candidate && <div className="prompt-candidate"><p>{candidate.explanation}</p>
            {!!candidate.retained.length && <p className="text-sm text-muted-foreground">保留：{candidate.retained.join('、')}</p>}
            {!!candidate.conflicts.length && <p className="text-sm font-medium">要求冲突：{candidate.conflicts.join('；')}</p>}
            {!!candidate.parameterSuggestions.length && <p className="text-sm">参数建议：{candidate.parameterSuggestions.join('；')}</p>}
            {!!candidate.added.length && <p className="text-sm text-muted-foreground">补充：{candidate.added.join('、')}</p>}
            <textarea aria-label="强化后的 Prompt" value={candidate.prompt} onChange={e => setCandidate({ ...candidate, prompt: e.target.value })} />
            <Button onClick={acceptCandidate}>接受修改</Button><Button variant="ghost" onClick={() => setCandidate(undefined)}>取消</Button>
          </div>}
          />
        </section>}
        </div>
        {workId && panelOpen && <ImageWorkspace>
          <h2>图片</h2>
          <ResultGallery key={workId} preview={preview} setPreview={setPreview} jobs={data.jobs} assets={resultAssets}
            revisions={data.revisions} busy={busy} onRestore={restoreRevision} onError={report} />
        </ImageWorkspace>}
        </div>
      </main>

    </div>
    <Notices />
    <SettingsDialog preferences={data.preferences} onChange={refresh} open={settings} onClose={() => setSettings(false)} />
  </div>
}
