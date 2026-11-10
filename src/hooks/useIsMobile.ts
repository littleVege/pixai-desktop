import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 639px)'
const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}
export const useIsMobile = () => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
