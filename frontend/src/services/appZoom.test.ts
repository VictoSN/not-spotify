import { beforeEach, describe, expect, it } from 'vitest'
import {
  APP_ZOOM_DEFAULT,
  APP_ZOOM_MAX,
  APP_ZOOM_MIN,
  APP_ZOOM_STORAGE_KEY,
  clampAppZoom,
  readAppZoom,
  resetAppZoom,
  setAppZoom,
} from './appZoom'

describe('app zoom preferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.style.removeProperty('--ns-app-zoom')
  })

  it('clamps zoom into the supported range', () => {
    expect(clampAppZoom(0.2)).toBe(APP_ZOOM_MIN)
    expect(clampAppZoom(2)).toBe(APP_ZOOM_MAX)
    expect(clampAppZoom(Number.NaN)).toBe(APP_ZOOM_DEFAULT)
  })

  it('persists and applies zoom', () => {
    setAppZoom(1.15)

    expect(window.localStorage.getItem(APP_ZOOM_STORAGE_KEY)).toBe('1.15')
    expect(document.documentElement.style.getPropertyValue('--ns-app-zoom')).toBe('1.15')
    expect(readAppZoom()).toBe(1.15)
  })

  it('resets to default zoom', () => {
    setAppZoom(1.25)
    resetAppZoom()

    expect(readAppZoom()).toBe(1)
    expect(document.documentElement.style.getPropertyValue('--ns-app-zoom')).toBe('1')
  })
})
