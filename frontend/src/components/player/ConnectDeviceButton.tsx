import { useEffect, useRef, useState } from 'react'
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline'
import { PlayIcon, PauseIcon, ForwardIcon, BackwardIcon } from '@heroicons/react/24/solid'
import { useConnectStore } from '@/stores/connectStore'
import { connectClient } from '@/services/connectClient'
import { cn } from '@/utils/cn'

function deviceIcon(kind: string) {
  return kind === 'mobile' ? DevicePhoneMobileIcon : ComputerDesktopIcon
}

/**
 * Spotify-Connect device switcher for the player bar. Lists the account's live
 * devices, lets you transfer playback to any of them, and — when another device
 * is the active player — shows "Playing on X" with remote transport controls.
 * Hidden until at least one device has registered (i.e. signed in + connected).
 */
export function ConnectDeviceButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const devices = useConnectStore((s) => s.devices)
  const activeDeviceId = useConnectStore((s) => s.activeDeviceId)
  const thisDeviceId = useConnectStore((s) => s.thisDeviceId)
  const remoteState = useConnectStore((s) => s.remoteState)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (devices.length === 0) return null

  const thisActive = activeDeviceId == null || activeDeviceId === thisDeviceId
  const remoteDevice = devices.find((d) => d.deviceId === activeDeviceId && d.deviceId !== thisDeviceId) ?? null
  const remoteTrack = remoteState?.track ?? null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'hidden transition-all hover:scale-110 active:scale-90 sm:block',
          !thisActive ? 'text-accent hover:text-accent' : 'text-secondary hover:text-primary',
        )}
        aria-label="Connect to a device"
        aria-pressed={open}
        title={!thisActive && remoteDevice ? `Playing on ${remoteDevice.name}` : 'Connect to a device'}
      >
        <SpeakerWaveIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-3 w-72 rounded-lg bg-elevated p-3 shadow-xl ring-1 ring-primary/10">
          <p className="mb-2 px-1 text-sm font-bold text-primary">Connect to a device</p>

          {!thisActive && remoteDevice && (
            <div className="mb-3 rounded-md bg-accent/10 p-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent">
                Playing on {remoteDevice.name}
              </p>
              {remoteTrack && (
                <>
                  <p className="mt-1 truncate text-sm font-semibold text-primary">{remoteTrack.title}</p>
                  <p className="truncate text-xs text-secondary">{remoteTrack.artist.name}</p>
                </>
              )}
              <div className="mt-2 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => connectClient.command('prev')}
                  className="text-secondary transition-colors hover:text-primary"
                  aria-label="Previous"
                >
                  <BackwardIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => connectClient.command(remoteState?.isPlaying ? 'pause' : 'play')}
                  className="text-primary transition-transform hover:scale-105"
                  aria-label={remoteState?.isPlaying ? 'Pause' : 'Play'}
                >
                  {remoteState?.isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
                </button>
                <button
                  type="button"
                  onClick={() => connectClient.command('next')}
                  className="text-secondary transition-colors hover:text-primary"
                  aria-label="Next"
                >
                  <ForwardIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          <ul className="space-y-0.5">
            {devices.map((d) => {
              const Icon = deviceIcon(d.kind)
              const isThis = d.deviceId === thisDeviceId
              return (
                <li key={d.deviceId}>
                  <button
                    type="button"
                    disabled={d.isActive}
                    onClick={() => {
                      if (!d.isActive) connectClient.transfer(d.deviceId)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                      d.isActive ? 'text-accent' : 'text-primary hover:bg-primary/10',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {d.name}
                      {isThis && <span className="font-normal text-secondary"> · this device</span>}
                    </span>
                    {d.isActive && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide">Active</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
