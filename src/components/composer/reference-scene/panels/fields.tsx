import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { Slider } from '@/components/ui/slider'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import type { ReferenceScene, Vec3 } from '@/lib/reference-scene/types.ts'

export const editScene = (recipe: (s: ReferenceScene) => void, key?: string) => useReferenceSceneStore.getState().edit(recipe, key)
export const endGesture = () => useReferenceSceneStore.getState().endGesture()

export function Section({ title, children, actions, className }: { title?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-2.5 border-b px-4 py-3 last:border-b-0', className)}>
      {(title || actions) && <div className="flex items-center gap-2"><h3 className="flex-1 text-xs font-medium text-muted-foreground">{title}</h3>{actions}</div>}
      {children}
    </section>
  )
}

/** Number input that only commits parseable values; shows the live value when not focused. */
export function NumberInput({ value, onChange, step = 0.01, min, max, suffix, className, 'aria-label': label }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; className?: string; 'aria-label'?: string
}) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(String(Math.round(value * 1000) / 1000)) }, [value, focused])
  return (
    <label className={cn('flex h-7 min-w-0 items-center rounded-md border bg-background px-1.5 text-xs focus-within:ring-2 focus-within:ring-ring/50', className)}>
      <input
        type="number" inputMode="decimal" aria-label={label} step={step} min={min} max={max} value={text}
        className="w-full min-w-0 bg-transparent tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); endGesture() }}
        onChange={e => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n)) onChange(min !== undefined || max !== undefined ? Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)) : n)
        }}
      />
      {suffix && <span className="pl-1 text-muted-foreground">{suffix}</span>}
    </label>
  )
}

export function Vec3Input({ label, value, onChange, step = 0.05, suffix }: { label: string; value: Vec3; onChange: (v: Vec3) => void; step?: number; suffix?: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_1fr_1fr] items-center gap-1.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      {(['X', 'Y', 'Z'] as const).map((axis, i) => (
        <NumberInput key={axis} aria-label={`${label} ${axis}`} value={value[i]} step={step} suffix={suffix}
          onChange={v => { const next = [...value] as Vec3; next[i] = v; onChange(next) }} />
      ))}
    </div>
  )
}

/** Labelled slider with a number box. Drags share one undo step via `gestureKey`. */
export function SliderRow({ label, value, min, max, step = 1, onChange, suffix, hint, danger, className }: {
  label: React.ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string; hint?: React.ReactNode; danger?: boolean; className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-2 text-xs">
        <span className={cn('flex-1 truncate', danger ? 'text-red-500' : 'text-muted-foreground')}>{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground tabular-nums">{hint}</span>}
        <NumberInput value={value} onChange={onChange} step={step} suffix={suffix} className="w-[4.5rem] flex-none" aria-label={typeof label === 'string' ? label : undefined} />
      </div>
      <Slider value={[Math.min(max, Math.max(min, value))]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} onValueCommit={endGesture} className={cn(danger && '[&_[data-slot=slider-range]]:bg-red-500')} />
    </div>
  )
}
