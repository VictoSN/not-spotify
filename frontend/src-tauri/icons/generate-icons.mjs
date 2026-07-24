// Downloads the PWA icons from the deployed frontend bucket before each Tauri
// build, so repository source contains no binary icon assets.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ASSET_BASE_URL =
  'https://api.not-spotify.lol/storage/app-assets/frontend/public/icons'

async function downloadIcon(name) {
  const response = await fetch(`${FRONTEND_ASSET_BASE_URL}/${name}`)
  if (!response.ok) {
    throw new Error(`Could not download ${name}: ${response.status} ${response.statusText}`)
  }
  const icon = Buffer.from(await response.arrayBuffer())
  const pngSignature = '89504e470d0a1a0a'
  if (icon.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error(`Could not download ${name}: response was not a PNG image`)
  }
  return icon
}

// Keep the generated desktop icons local and out of Git. Tauri's icon command
// creates a real Windows ICO; manually embedding a PNG in an ICO breaks older
// Windows resource compilers.
const sourcePng = join(here, 'icon.png')
writeFileSync(sourcePng, await downloadIcon('icon-512.png'))
execFileSync('npx', ['tauri', 'icon', sourcePng], {
  cwd: join(here, '..', '..'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
console.log('Downloaded the PWA icon from S3 and generated local Tauri icons')
