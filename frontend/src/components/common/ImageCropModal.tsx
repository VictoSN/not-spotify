import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'

interface ImageCropModalProps {
  file: File | null
  aspectRatio: number
  title: string
  outputWidth?: number
  onCancel: () => void
  onCrop: (file: File) => void
}

interface Size {
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

interface ImageSource {
  file: File
  url: string
}

export function ImageCropModal({
  file,
  aspectRatio,
  title,
  outputWidth = 1200,
  onCancel,
  onCrop,
}: ImageCropModalProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null)
  const [source, setSource] = useState<ImageSource | null>(null)
  const sourceUrl = source?.file === file ? source.url : null
  const [imageSize, setImageSize] = useState<Size | null>(null)
  const [viewportSize, setViewportSize] = useState<Size | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [isCropping, setIsCropping] = useState(false)

  // Reset zoom/pan before the new source paints. imageSize is measured
  // separately below; relying only on the visible <img> load event can miss
  // cached blobs and leave the cropper black with a dead "Use image" button.
  useLayoutEffect(() => {
    if (!sourceUrl) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setImageSize(null)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    })
    return () => { cancelled = true }
  }, [sourceUrl])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setSource(null)
    })
    if (!file) {
      return () => { cancelled = true }
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (!cancelled && typeof reader.result === 'string') {
        setSource({ file, url: reader.result })
      }
    }
    reader.onerror = () => {
      if (!cancelled) setSource(null)
    }
    reader.readAsDataURL(file)

    return () => {
      cancelled = true
      if (reader.readyState === FileReader.LOADING) reader.abort()
    }
  }, [file])

  // Measure the source image's intrinsic size off-DOM via decode(), so it resolves
  // reliably whether or not the browser serves the blob from cache.
  useEffect(() => {
    if (!sourceUrl) return
    let cancelled = false
    const probe = new Image()
    const apply = () => {
      if (!cancelled && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        setImageSize({ width: probe.naturalWidth, height: probe.naturalHeight })
      }
    }
    probe.src = sourceUrl
    probe.decode().then(apply).catch(() => {
      if (probe.complete) apply()
      else probe.onload = apply
    })
    return () => { cancelled = true }
  }, [sourceUrl])

  // Track the crop viewport size: measure synchronously on open so the first paint
  // already has a layout, then keep it live with a ResizeObserver.
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (el) setViewportSize({ width: el.clientWidth, height: el.clientHeight })
  }, [sourceUrl])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [sourceUrl])

  const getLayout = (zoomValue = zoom) => {
    if (!viewportSize || !imageSize) return null

    const viewportWidth = viewportSize.width
    const viewportHeight = viewportSize.height
    const baseScale = Math.max(viewportWidth / imageSize.width, viewportHeight / imageSize.height)
    const scale = baseScale * zoomValue
    const renderedWidth = imageSize.width * scale
    const renderedHeight = imageSize.height * scale

    return { viewportWidth, viewportHeight, scale, renderedWidth, renderedHeight }
  }

  const clampOffset = (next: Point, zoomValue = zoom): Point => {
    const layout = getLayout(zoomValue)
    if (!layout) return next
    const maxX = Math.max(0, (layout.renderedWidth - layout.viewportWidth) / 2)
    const maxY = Math.max(0, (layout.renderedHeight - layout.viewportHeight) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    }
  }

  const handleZoom = (value: number) => {
    setZoom(value)
    setOffset((current) => clampOffset(current, value))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSize) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: offset,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset(clampOffset({
      x: drag.origin.x + event.clientX - drag.start.x,
      y: drag.origin.y + event.clientY - drag.start.y,
    }))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  const createCrop = async () => {
    if (!file || !sourceUrl || !imageSize) return
    const layout = getLayout()
    if (!layout) return

    setIsCropping(true)
    try {
      const image = new Image()
      image.src = sourceUrl
      await image.decode()

      const sourceWidth = layout.viewportWidth / layout.scale
      const sourceHeight = layout.viewportHeight / layout.scale
      const sourceX = (imageSize.width - sourceWidth) / 2 - offset.x / layout.scale
      const sourceY = (imageSize.height - sourceHeight) / 2 - offset.y / layout.scale
      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = Math.round(outputWidth / aspectRatio)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Image cropping is not supported in this browser.')

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      )

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error('Could not create the cropped image.')),
          'image/jpeg',
          0.92,
        )
      })
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
      onCrop(new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' }))
    } finally {
      setIsCropping(false)
    }
  }

  const layout = getLayout()

  return (
    <Dialog open={file !== null} onClose={onCancel} className="relative z-[80]">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className="w-full max-w-3xl rounded-2xl border border-primary/10 bg-surface p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-bold text-primary">{title}</DialogTitle>
                <p className="mt-1 text-sm text-secondary">Drag to reposition, then zoom until it looks right.</p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full p-2 text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Close image cropper"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div
              ref={viewportRef}
              className="relative w-full touch-none cursor-grab select-none overflow-hidden rounded-lg bg-black active:cursor-grabbing"
              style={{ aspectRatio }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {sourceUrl && (
                <img
                  src={sourceUrl}
                  alt="Crop preview"
                  draggable={false}
                  onLoad={(event) => setImageSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                  style={layout ? {
                    width: layout.renderedWidth,
                    height: layout.renderedHeight,
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  } : undefined}
                />
              )}
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/40" />
              <div className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/25" />
              <div className="pointer-events-none absolute inset-y-0 right-1/3 border-r border-white/25" />
              <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/25" />
              <div className="pointer-events-none absolute inset-x-0 bottom-1/3 border-b border-white/25" />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <ArrowsPointingOutIcon className="h-5 w-5 shrink-0 text-secondary" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => handleZoom(Number(event.target.value))}
                className="w-full accent-[#1ed760]"
                aria-label="Image zoom"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={isCropping}>Cancel</Button>
              <Button type="button" onClick={createCrop} disabled={!imageSize || isCropping}>
                {isCropping ? 'Cropping…' : 'Use image'}
              </Button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
