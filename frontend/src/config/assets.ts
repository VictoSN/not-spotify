const DEFAULT_ASSET_BASE_URL =
  'https://localhost:7045/storage/app-assets'

const configuredBaseUrl = (
  import.meta.env.VITE_ASSET_BASE_URL ||
  (import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/storage/app-assets`
    : DEFAULT_ASSET_BASE_URL)
).replace(/\/$/, '')

export function assetUrl(path: string): string {
  return `${configuredBaseUrl}/${path.replace(/^\/+/, '')}`
}

export const APP_PREVIEW_URL = assetUrl('frontend/public/app-preview.svg')
export const APP_ICON_192_URL = assetUrl('frontend/public/icons/icon-192.png')
