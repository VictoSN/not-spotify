// Downloads the PWA icons from the deployed frontend bucket before each Tauri
// build, so repository source contains no binary icon assets.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ASSET_BASE_URL = 'https://not-spotify.lol/icons'

async function downloadIcon(name) {
  const response = await fetch(`${FRONTEND_ASSET_BASE_URL}/${name}`)
  if (!response.ok) {
    throw new Error(`Could not download ${name}: ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

// icon.png is the master PNG for the Tauri bundler.
writeFileSync(join(here, 'icon.png'), await downloadIcon('icon-512.png'))

// icon.ico wraps the 192px PNG in a single-image ICO container.
const png = await downloadIcon('icon-192.png')
const size = 192

const ICONDIR = Buffer.alloc(6)
ICONDIR.writeUInt16LE(0, 0)
ICONDIR.writeUInt16LE(1, 2)
ICONDIR.writeUInt16LE(1, 4)

const ICONDIRENTRY = Buffer.alloc(16)
ICONDIRENTRY.writeUInt8(size, 0)
ICONDIRENTRY.writeUInt8(size, 1)
ICONDIRENTRY.writeUInt8(0, 2)
ICONDIRENTRY.writeUInt8(0, 3)
ICONDIRENTRY.writeUInt16LE(1, 4)
ICONDIRENTRY.writeUInt16LE(32, 6)
ICONDIRENTRY.writeUInt32LE(png.length, 8)
ICONDIRENTRY.writeUInt32LE(6 + 16, 12)

writeFileSync(join(here, 'icon.ico'), Buffer.concat([ICONDIR, ICONDIRENTRY, png]))
console.log('Downloaded PWA icons and generated Tauri icon.png and icon.ico')
