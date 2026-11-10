import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Sparkles, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from 'cn'
import { Composer } from '@/components/composer/Composer'
import { useComposerStore } from '@/store/composerStore'
import { findModel, generations } from '@/mock/data'
import type { ComposerSubmission } from '@/types'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import { LOCALES, type Locale } from '@/i18n'
import { generate, resumeGeneration, serverHealth, type GenerationState } from './generation'
import { clearSubmissions, loadSubmissions, saveSubmissions, type SubmissionEntry } from './persistence'

const THEMES = [
  { id: 'light', icon: Sun },
  { id: 'dark', icon: Moon },
  { id: 'midnight', icon: Sparkles },
] as const
type Theme = (typeof THEMES)[number]['id']

/** Saved choice, else the host's explicit light/dark, else the OS preference. */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme')
    if (saved && THEMES.some(t => t.id === saved)) return saved as Theme
  } catch { /* storage unavailable */ }
  const host = document.documentElement.dataset.theme
  if (host === 'light' || host === 'dark') return host
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const { i18n } = useTranslation()
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [submissions, setSubmissions] = useState<SubmissionEntry[]>(loadSubmissions)
  const [confirmClear, setConfirmClear] = useState(false)
  const [server, setServer] = useState<'checking' | 'ready' | 'no-key' | 'offline'>('checking')
  const [live, setLive] = useState(true)
  const [newUser, setNewUser] = useState(false)
  const promptHistory = useMemo(
    () => [...submissions.map(x => x.s.prompt), ...(newUser ? [] : generations.map(g => g.prompt ?? ''))],
    [submissions, newUser],
  )
  const maxLoras = useComposerStore(s => s.maxLoras)
  const setMaxLoras = useComposerStore(s => s.setMaxLoras)
  const reset = useComposerStore(s => s.reset)

  useEffect(() => {
    serverHealth().then(h => setServer(h.hasKey ? 'ready' : 'no-key')).catch(() => setServer('offline'))
  }, [])

  const updateGen = (id: number) => (gen: GenerationState) => setSubmissions(list => list.map(x => (x.id === id ? { ...x, gen } : x)))

  useEffect(() => { saveSubmissions(submissions) }, [submissions])

  // Tasks still running when the page was last closed: pick up polling once the demo server is reachable.
  const resumed = useRef(new Set<number>())
  useEffect(() => {
    if (server !== 'ready') return
    for (const x of submissions) {
      if (x.gen?.phase !== 'running' || resumed.current.has(x.id)) continue
      resumed.current.add(x.id)
      void resumeGeneration(x.gen.taskId, updateGen(x.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server])

  useEffect(() => {
    if (!confirmClear) return
    const t = setTimeout(() => setConfirmClear(false), 3000)
    return () => clearTimeout(t)
  }, [confirmClear])

  const onSubmit = (s: ComposerSubmission) => {
    const id = Date.now()
    const runLive = live && server === 'ready'
    setSubmissions(list => [{ id, at: new Date(), s, gen: runLive ? { phase: 'uploading' } : undefined }, ...list])
    if (!runLive) return
    resumed.current.add(id)
    void generate(s, useComposerStore.getState().references, updateGen(id))
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch { /* storage unavailable */ }
  }, [theme])

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:flex-row">
      <main className="relative flex min-h-dvh flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <span className="font-semibold tracking-tight">PixAI Composer</span>
          <span className="text-xs text-muted-foreground">prototype</span>
          <div className="flex-1" />
          <ToggleGroup type="single" variant="outline" size="sm" value={theme} onValueChange={v => v && setTheme(v as Theme)}>
            {THEMES.map(({ id, icon: Icon }) => <ToggleGroupItem key={id} value={id} aria-label={id}><Icon className="size-4" /></ToggleGroupItem>)}
          </ToggleGroup>
          <ToggleGroup type="single" variant="outline" size="sm" value={i18n.language} onValueChange={v => v && void i18n.changeLanguage(v as Locale)}>
            {LOCALES.map(l => <ToggleGroupItem key={l} value={l} className="uppercase">{l}</ToggleGroupItem>)}
          </ToggleGroup>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={maxLoras === 15} onCheckedChange={c => setMaxLoras(c ? 15 : 3)} /> Member ({maxLoras} LoRA)
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={newUser} onCheckedChange={setNewUser} /> New user
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground" title={server === 'ready' ? 'Submissions run on PixAI through the demo server' : server === 'no-key' ? 'Set PIXAI_API_KEY in .env' : 'Start the demo server: pnpm server'}>
            <Switch checked={live && server === 'ready'} disabled={server !== 'ready'} onCheckedChange={setLive} /> PixAI {server === 'ready' ? '' : `(${server === 'checking' ? '…' : server})`}
          </label>
          <Button variant="ghost" size="icon-sm" aria-label="reset" onClick={reset}><Trash2 /></Button>
        </header>

        <div className="flex flex-1 flex-col items-center justify-end px-4 pb-4 sm:px-6 sm:pb-8">
          <div className="hidden flex-1 items-center justify-center text-center text-muted-foreground sm:flex">
            <p className="max-w-md text-balance">Try typing <kbd className="rounded border bg-muted px-1 font-mono text-xs">/</kbd> for recipes and LoRAs, <kbd className="rounded border bg-muted px-1 font-mono text-xs">@</kbd> for references, or paste an image.</p>
          </div>
          <Composer promptHistory={promptHistory} onSubmit={onSubmit} className="max-w-3xl" />
        </div>
      </main>

      <aside className="border-t lg:w-96 lg:border-t-0 lg:border-l">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="font-medium">Submissions <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">{submissions.length}</span></span>
          {submissions.length > 0 && (
            <Button variant={confirmClear ? 'destructive' : 'ghost'} size="xs"
              onClick={() => { if (!confirmClear) { setConfirmClear(true); return } setSubmissions([]); clearSubmissions(); setConfirmClear(false) }}>
              {confirmClear ? 'Click again to clear' : 'Clear history'}
            </Button>
          )}
        </div>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 pb-4 lg:max-h-[calc(100dvh-48px)]">
          {submissions.length === 0 && <p className="text-sm text-muted-foreground">Nothing generated yet. History is kept in this browser.</p>}
          {submissions.map(({ id, at, s, gen }, i) => (
            <details key={id} open={i === 0} className={cn('rounded-xl border bg-card p-3 text-xs')}>
              <summary className="cursor-pointer text-sm">
                <span className="font-medium">{findModel(s.modelVersionId)?.title}</span>
                <span className="ml-2 text-muted-foreground">{at.toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {s.aspectRatio} · ×{s.batchSize}</span>
              </summary>
              {gen && <GenerationResult gen={gen} />}
              <p className="mt-2 whitespace-pre-wrap">{s.prompt || <em className="text-muted-foreground">(no prompt)</em>}</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-2 font-mono text-[11px] leading-relaxed">{JSON.stringify({ ...s, promptDoc: '…' }, null, 2)}</pre>
            </details>
          ))}
        </div>
      </aside>
    </div>
  )
}

function GenerationResult({ gen }: { gen: GenerationState }) {
  if (gen.phase === 'failed') return <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-500/10 p-2 text-red-600 dark:text-red-400"><AlertTriangle className="mt-px size-3.5 flex-none" /><span className="break-all">{gen.error}{gen.taskId && ` (task ${gen.taskId})`}</span></p>
  if (gen.phase !== 'done') return <p className="mt-2 flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />{gen.phase === 'uploading' ? 'Uploading references…' : `PixAI: ${gen.status} · task ${gen.taskId}`}</p>
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      {gen.images.map(img => (
        <a key={img.mediaId} href={img.url ?? undefined} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border bg-muted">
          {img.url ? <img src={img.url} alt={`media ${img.mediaId}`} className="w-full" /> : <span className="block p-2">media {img.mediaId}</span>}
        </a>
      ))}
      <p className="col-span-2 text-muted-foreground">task {gen.taskId} · media {gen.images.map(i => i.mediaId).join(', ')}</p>
    </div>
  )
}
