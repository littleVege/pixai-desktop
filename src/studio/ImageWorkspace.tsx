import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const widthKey = 'studio.imageWorkspace.width'
const minWidth = 290
const conversationWidth = 480

export function ImageWorkspace({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLElement>(null)
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)
  const [available, setAvailable] = useState(0)
  const [preferred, setPreferred] = useState(() => {
    const saved = Number(localStorage.getItem(widthKey))
    return Number.isFinite(saved) && saved >= minWidth ? saved : undefined
  })

  useLayoutEffect(() => {
    const container = panel.current!.parentElement!
    const measure = () => setAvailable(container.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const maxWidth = Math.max(minWidth, available - conversationWidth)
  const clamp = (value: number) => Math.round(Math.min(maxWidth, Math.max(minWidth, value)))
  const width = clamp(preferred ?? Math.min(440, available * 0.29))

  function commit(value: number) {
    const next = clamp(value)
    setPreferred(next)
    localStorage.setItem(widthKey, String(next))
  }

  return <aside ref={panel} id="image-workspace" className="image-workspace" aria-label="图片工作区" style={{ width }}>
    <div className="workspace-divider" role="separator" tabIndex={0} aria-label="调整图片工作区宽度"
      aria-orientation="vertical" aria-controls="image-workspace" aria-valuemin={minWidth} aria-valuemax={maxWidth}
      aria-valuenow={width} aria-valuetext={width + ' 像素'}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return
        drag.current = { startX: event.clientX, startWidth: width }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
        setPreferred(clamp(drag.current.startWidth + drag.current.startX - event.clientX))
      }}
      onPointerUp={event => {
        if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
        commit(drag.current.startWidth + drag.current.startX - event.clientX)
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onLostPointerCapture={() => { drag.current = null }}
      onKeyDown={event => {
        const target = { ArrowLeft: width + 16, ArrowRight: width - 16, Home: minWidth, End: maxWidth }[event.key]
        if (target === undefined) return
        event.preventDefault()
        commit(target)
      }}
    />
    <div className="image-workspace-content">{children}</div>
  </aside>
}
