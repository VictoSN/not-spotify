// Generates the PWA PNG icons from scratch (no image libraries).
// Pure Node: rasterizes a simple beamed-eighth-note brand mark and encodes a
// PNG with zlib. Re-run with `node scripts/generate-icons.mjs` if the brand
// colors change. Output lands in public/icons/.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'icons')

const BG = [0x00, 0x00, 0x00] // app base background (#000000)
const FG = [0x1e, 0xd7, 0x60] // Spotify-green accent (#1ed760)

// ── CRC32 (for PNG chunk checksums) ───────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // 10,11,12 = compression/filter/interlace = 0
  // Add a filter byte (0 = none) at the start of each scanline.
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Drawing helpers (normalized 0..1 coordinates, y points down) ──
function drawIcon(size, { padding = 0 } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const set = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 4
    buf[i] = r
    buf[i + 1] = g
    buf[i + 2] = b
    buf[i + 3] = 255
  }
  // Background: full bleed (safe for maskable).
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG)

  // Map a normalized note design into the (padded) safe area.
  const lo = padding
  const span = 1 - padding * 2
  const nx = (u) => Math.round((lo + u * span) * size)
  const sc = (u) => u * span * size

  const inEllipse = (px, py, cu, cv, ru, rv) => {
    const dx = (px - nx(cu)) / sc(ru)
    const dy = (py - nx(cv)) / sc(rv)
    return dx * dx + dy * dy <= 1
  }
  const inRect = (px, py, u0, v0, u1, v1) =>
    px >= nx(u0) && px <= nx(u1) && py >= nx(v0) && py <= nx(v1)
  // Slanted beam between two stem tops (a thin parallelogram).
  const inBeam = (px, py) => {
    const x0 = nx(0.40), x1 = nx(0.82)
    if (px < x0 || px > x1) return false
    const t = (px - x0) / (x1 - x0)
    const topY = nx(0.22) - t * sc(0.06) // right edge sits higher
    return py >= topY && py <= topY + sc(0.1)
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const note =
        inEllipse(x, y, 0.30, 0.74, 0.13, 0.1) || // left note head
        inEllipse(x, y, 0.685, 0.66, 0.13, 0.1) || // right note head
        inRect(x, y, 0.40, 0.22, 0.445, 0.74) || // left stem
        inRect(x, y, 0.775, 0.16, 0.82, 0.66) || // right stem
        inBeam(x, y)
      if (note) set(x, y, FG)
    }
  }
  return encodePng(size, size, buf)
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'icon-192.png'), drawIcon(192))
writeFileSync(join(OUT_DIR, 'icon-512.png'), drawIcon(512))
// Maskable icons need ~10% safe padding so the OS mask never clips the mark.
writeFileSync(join(OUT_DIR, 'icon-maskable-512.png'), drawIcon(512, { padding: 0.12 }))
console.log('Wrote icon-192.png, icon-512.png, icon-maskable-512.png to', OUT_DIR)
