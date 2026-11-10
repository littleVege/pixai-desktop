import { useEffect, useRef, useState } from 'react'
import { CircleAlert, X } from 'lucide-react'

export function reportError(error: unknown) {
  if (!error) return
  const message = (error instanceof Error ? error.message : String(error)).replace(/^(?:Error:\s*|Error invoking remote method '[^']+':\s*)+/g, '')
  window.dispatchEvent(new CustomEvent('studio-notice', { detail: message }))
}
export function Notices() {
  const ref = useRef<HTMLDivElement>(null)
  const [notice, setNotice] = useState<{ message: string }>()
  useEffect(() => {
    const receive = (event: Event) => setNotice({ message: (event as CustomEvent<string>).detail })
    window.addEventListener('studio-notice', receive)
    return () => window.removeEventListener('studio-notice', receive)
  }, [])
  useEffect(() => {
    if (!notice) return
    ref.current?.showPopover()
    const timer = setTimeout(() => setNotice(undefined), 10000)
    return () => clearTimeout(timer)
  }, [notice])
  return notice && <div ref={ref} popover="manual" className="studio-notice" role="alert"><CircleAlert size={18}/><span>{notice.message}</span><button aria-label="关闭提示" onClick={() => setNotice(undefined)}><X size={16}/></button></div>
}
