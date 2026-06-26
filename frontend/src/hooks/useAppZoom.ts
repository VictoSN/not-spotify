import { useEffect, useState } from 'react'
import {
  APP_ZOOM_CHANGE_EVENT,
  APP_ZOOM_DEFAULT,
  clampAppZoom,
  readAppZoom,
  resetAppZoom,
  setAppZoom,
  stepAppZoom,
} from '@/services/appZoom'

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  const tag = el?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable
}

export function useAppZoomShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isEditableTarget(event.target)) return

      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        stepAppZoom(1)
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        stepAppZoom(-1)
      } else if (event.key === '0') {
        event.preventDefault()
        resetAppZoom()
      }
    }

    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      stepAppZoom(event.deltaY < 0 ? 1 : -1)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])
}

export function useAppZoomPreference() {
  const [zoom, setZoomState] = useState(() => readAppZoom())

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<{ zoom?: number }>).detail?.zoom
      setZoomState(clampAppZoom(next ?? readAppZoom()))
    }
    window.addEventListener(APP_ZOOM_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(APP_ZOOM_CHANGE_EVENT, onChange)
  }, [])

  return {
    zoom,
    percent: Math.round(zoom * 100),
    isDefault: zoom === APP_ZOOM_DEFAULT,
    setZoom: (value: number) => setZoomState(setAppZoom(value)),
    resetZoom: () => setZoomState(resetAppZoom()),
  }
}
