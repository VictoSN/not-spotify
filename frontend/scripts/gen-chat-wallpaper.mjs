// Regenerates the chat doodle wallpaper tile (public/chat-doodle-wallpaper.svg).
//
//   node scripts/gen-chat-wallpaper.js            # writes the tile in place
//   node scripts/gen-chat-wallpaper.js out.svg    # writes elsewhere
//
// It composes a WhatsApp-style collage: 8 extra-large "anchor" doodles, each
// wrapped in a cluster of medium/small/tiny fillers, plus a global scatter, all
// edge-wrapped so the 600×600 tile repeats seamlessly. The tile is painted at
// background-size 450px (see .chat-wallpaper::before in index.css), so visible
// size ≈ ext * scale * 1.5 px. Tweak SEED / counts / target-px ranges below and
// re-run. The <defs> symbol library is shared with the old tile.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Symbol library (verbatim from the existing tile) ────────────────────────
const DEFS = `  <defs>
    <style>
      .line{fill:none;stroke:#e8eeee;stroke-width:1.25;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
    </style>

    <g id="star" class="line"><path d="M0-10 3-4 10-3 4.8 1.8 6.3 9 0 5-6.3 9-4.8 1.8-10-3-3-4Z"/></g>
    <g id="spark" class="line"><path d="M0-8 2.2-2.2 8 0 2.2 2.2 0 8-2.2 2.2-8 0-2.2-2.2Z"/></g>
    <g id="plus" class="line"><path d="M0-6v12M-6 0H6"/></g>
    <g id="diamond" class="line"><path d="M0-8 8 0 0 8-8 0Z"/></g>
    <g id="triangle" class="line"><path d="M0-9 9 7-9 7Z"/></g>
    <g id="ring" class="line"><circle r="6"/><circle r="2"/></g>
    <g id="dots" class="line"><path d="M-8 0h.1M0 0h.1M8 0h.1"/></g>
    <g id="tiny-heart" class="line"><path d="M0 4C-2.2 1.8-5 .4-5-2.4-5-4.9-2.2-5.5 0-3.2 2.2-5.5 5-4.9 5-2.4 5 .4 2.2 1.8 0 4Z"/></g>
    <g id="bolt" class="line"><path d="M2-11-7 2h6l-3 11L8-4H2Z"/></g>
    <g id="check" class="line"><path d="M-9 1-3 7 10-8"/></g>
    <g id="xmark" class="line"><path d="M-7-7 7 7M7-7-7 7"/></g>

    <g id="heart" class="line"><path d="M0 9C-4 5-11 1-11-5.5c0-5 5.6-6.4 11-1.2 5.4-5.2 11-3.8 11 1.2C11 1 4 5 0 9Z"/></g>
    <g id="chat" class="line"><rect x="-15" y="-9" width="30" height="18" rx="5"/><path d="M-4 9-11 16-10.2 9"/></g>
    <g id="speech" class="line"><path d="M-17-9h34v20h-12l-8 7 1.5-7H-17Z"/><path d="M-9-2h17M-9 4H4"/></g>
    <g id="envelope" class="line"><rect x="-17" y="-10" width="34" height="22" rx="3"/><path d="M-17-7 0 5 17-7"/></g>
    <g id="phone" class="line"><rect x="-7" y="-14" width="14" height="28" rx="3"/><path d="M-2 10h4"/></g>
    <g id="camera" class="line"><rect x="-15" y="-9" width="30" height="20" rx="4"/><path d="M-7-9-4-13h8l3 4"/><circle r="5"/><path d="M10-4h.1"/></g>
    <g id="video" class="line"><rect x="-16" y="-10" width="24" height="20" rx="4"/><path d="M8-3 17-9v18L8 3Z"/></g>
    <g id="laptop" class="line"><rect x="-15" y="-11" width="30" height="20" rx="2"/><path d="M-20 13h40l-5-4H-15Z"/></g>
    <g id="gamepad" class="line"><rect x="-19" y="-9" width="38" height="18" rx="7"/><path d="M-11 0h8M-7-4v8M6-3h.1M12 3h.1"/></g>
    <g id="tv" class="line"><rect x="-18" y="-12" width="36" height="24" rx="3"/><path d="M-7 17H7M-10 12 0 17 10 12M-8-17 0-12 8-17"/></g>
    <g id="watch" class="line"><rect x="-8" y="-11" width="16" height="22" rx="6"/><path d="M-5-11-3-18h6l2 7M-5 11-3 18h6l2-7M0-4v5l4 2"/></g>
    <g id="bulb" class="line"><path d="M-8-2a8 8 0 1 1 16 0c0 4-3 6-4.5 9h-7C-5 4-8 2-8-2Z"/><path d="M-3 10h6M-2 14h4"/></g>
    <g id="key" class="line"><circle cx="-8" cy="0" r="6"/><path d="M-2 0h17M8 0v5M13 0v-4"/></g>
    <g id="lock" class="line"><rect x="-11" y="-2" width="22" height="16" rx="3"/><path d="M-6-2v-5a6 6 0 0 1 12 0v5M0 4v4"/></g>
    <g id="calendar" class="line"><rect x="-14" y="-11" width="28" height="24" rx="3"/><path d="M-14-4h28M-7-15v7M7-15v7M-7 3h.1M0 3h.1M7 3h.1M-7 9h.1M0 9h.1"/></g>
    <g id="clock" class="line"><circle r="12"/><path d="M0-6v7l5 3"/></g>
    <g id="magnifier" class="line"><circle cx="-4" cy="-4" r="9"/><path d="M3 3 13 13"/></g>

    <g id="music" class="line"><path d="M5-14V4"/><path d="M5-14c7 1 10 4 10 9"/><ellipse cx="0" cy="5" rx="5" ry="3.6" transform="rotate(-15)"/></g>
    <g id="double-music" class="line"><path d="M-7-12V5M9-15V2"/><path d="M-7-12 9-15"/><ellipse cx="-11" cy="6" rx="4.8" ry="3.4" transform="rotate(-15 -11 6)"/><ellipse cx="5" cy="3" rx="4.8" ry="3.4" transform="rotate(-15 5 3)"/></g>
    <g id="headphones" class="line"><path d="M-13 6V1a13 13 0 0 1 26 0v5"/><rect x="-16" y="4" width="6" height="12" rx="3"/><rect x="10" y="4" width="6" height="12" rx="3"/></g>
    <g id="mic" class="line"><rect x="-5" y="-15" width="10" height="18" rx="5"/><path d="M-10-5v2a10 10 0 0 0 20 0v-2M0 8v6M-6 14H6"/></g>
    <g id="guitar" class="line"><path d="M-16 12 8-12M5-15l10 10"/><ellipse cx="-10" cy="7" rx="8" ry="5.5" transform="rotate(-35 -10 7)"/><circle cx="-8" cy="5" r="2.4"/></g>
    <g id="keyboard" class="line"><rect x="-19" y="-8" width="38" height="16" rx="3"/><path d="M-13-8v16M-7-8v9M-1-8v16M5-8v9M11-8v16"/></g>
    <g id="drum" class="line"><ellipse cy="-8" rx="13" ry="5"/><path d="M-13-8v18c4 5 22 5 26 0V-8M-18-16-8-9M18-16 8-9"/></g>
    <g id="record" class="line"><circle r="13"/><circle r="5"/><path d="M0 0h.1"/></g>

    <g id="cloud" class="line"><path d="M-16 7H11a6 6 0 0 0 1-12 9 9 0 0 0-17.5-2.5A7 7 0 0 0-16 7Z"/></g>
    <g id="rain" class="line"><path d="M-15 3H10a6 6 0 0 0 0-12 9 9 0 0 0-17-2 7 7 0 0 0-8 14Z"/><path d="M-9 8-12 14M0 8-3 14M9 8 6 14"/></g>
    <g id="moon" class="line"><path d="M4-13a13 13 0 1 0 8 17A10 10 0 0 1 4-13Z"/></g>
    <g id="sun" class="line"><circle r="6"/><path d="M0-16v5M0 16v-5M-16 0h5M16 0h-5M-11-11l4 4M11 11l-4-4M-11 11l4-4M11-11l-4 4"/></g>
    <g id="leaf" class="line"><path d="M-14 10C-5-12 10-15 16-11 18 1 5 11-14 10Z"/><path d="M-14 10C-4 4 6-2 16-11"/></g>
    <g id="flower" class="line"><circle r="3"/><ellipse cy="-9" rx="4" ry="5.5"/><ellipse cx="8" cy="-2.5" rx="4" ry="5.5" transform="rotate(72 8 -2.5)"/><ellipse cx="5" cy="7.5" rx="4" ry="5.5" transform="rotate(144 5 7.5)"/><ellipse cx="-5" cy="7.5" rx="4" ry="5.5" transform="rotate(216 -5 7.5)"/><ellipse cx="-8" cy="-2.5" rx="4" ry="5.5" transform="rotate(288 -8 -2.5)"/></g>
    <g id="tree" class="line"><path d="M0-17c-9 8-14 16-14 23 0 8 28 8 28 0 0-7-5-15-14-23Z"/><path d="M0 6v13M-6 13H6"/></g>
    <g id="palm" class="line"><path d="M0 18C2 6 2-3 0-14"/><path d="M0-13c-8-7-16-3-19 4 7-2 13-1 19-4ZM0-13c8-7 16-3 19 4-7-2-13-1-19-4ZM0-13c-3-9 5-14 12-12-4 4-7 8-12 12ZM0-13c3-9-5-14-12-12 4 4 7 8 12 12Z"/></g>
    <g id="mountain" class="line"><path d="M-20 14-7-8l7 10 8-14 15 26Z"/><path d="M-7-8-2 0M8-12l4 8"/></g>
    <g id="rainbow" class="line"><path d="M-19 10a19 19 0 0 1 38 0M-12 10a12 12 0 0 1 24 0M-5 10a5 5 0 0 1 10 0"/></g>
    <g id="wave" class="line"><path d="M-20 5c8-9 14-9 20 0s12 9 20 0M-18 13c8-5 13-5 18 0s10 5 18 0"/></g>
    <g id="swirl" class="line"><path d="M-15 7c4 8 20 9 27 0 7-10-4-22-15-15-9 6-4 18 6 14"/></g>

    <g id="planet" class="line"><circle r="12"/><path d="M-19 4c10 5 26 3 38-6M-18 6c7-1 13-4 18-8 7-5 13-7 18-6"/></g>
    <g id="rocket" class="line"><path d="M0-18c8 5 12 14 9 24L3 4l-7 7-3-3 7-7-2-6c10-3 19 1 24 9Z" transform="rotate(45)"/><circle cx="4" cy="-6" r="2.6" transform="rotate(45)"/><path d="M-9 9c-3 1-5 3-6 7 4-1 6-3 7-6" transform="rotate(45)"/></g>
    <g id="paper-plane" class="line"><path d="M-15 4 16-10 5 16 0 5Z"/><path d="M16-10 0 5"/></g>
    <g id="airplane" class="line"><path d="M-21 1 20-10 9 2l8 12-15-8-11 11-1-15Z"/></g>
    <g id="balloon" class="line"><ellipse cy="-6" rx="8" ry="11"/><path d="M0 5c-3 5 2 8-2 13M-4 5h8"/></g>
    <g id="compass" class="line"><circle r="13"/><path d="M5-9-2 3-8 9-2-3Z"/></g>
    <g id="suitcase" class="line"><rect x="-16" y="-9" width="32" height="22" rx="4"/><path d="M-6-9v-5H6v5M0-9v22"/></g>
    <g id="map-pin" class="line"><path d="M0 16S11 4 11-5A11 11 0 0 0-11-5c0 9 11 21 11 21Z"/><circle cy="-5" r="4"/></g>
    <g id="car" class="line"><path d="M-19 4h3l5-8H9l6 8h4v11h-38Z"/><circle cx="-11" cy="15" r="3"/><circle cx="11" cy="15" r="3"/><path d="M-8-4v8M8-4v8"/></g>
    <g id="bike" class="line"><circle cx="-15" cy="8" r="8"/><circle cx="16" cy="8" r="8"/><path d="M-15 8-5-8h10L16 8M-5-8 1 8h-16M1 8 6-1M-9-8h8M5-8h8"/></g>
    <g id="train" class="line"><rect x="-15" y="-14" width="30" height="24" rx="4"/><path d="M-9-7h18M-9 0h18M-10 15l5-5M10 15l-5-5M-7 10h.1M7 10h.1"/></g>
    <g id="ship" class="line"><path d="M-19 4h38l-7 11H-12Z"/><path d="M-5 4V-13H8L14 4M-5-7h16"/></g>

    <g id="burger" class="line"><path d="M-18 1c2-9 34-9 36 0ZM-17 5h34M-15 10h30M-14 14h28"/><path d="M-9 1c0-2 3-2 3 0M1 1c0-2 3-2 3 0M10 1c0-2 3-2 3 0"/></g>
    <g id="pizza" class="line"><path d="M-11-14 17-6-3 18Z"/><path d="M-6-8c7 5 12 7 17 7"/><circle cx="0" cy="-2" r="2"/><circle cx="4" cy="7" r="2"/><circle cx="-4" cy="9" r="1.8"/></g>
    <g id="cup" class="line"><path d="M-12-6H7v10a9.5 9.5 0 0 1-19 0Z"/><path d="M7-4h4a4 4 0 0 1 0 8H7M-5-11c2-2 2-4 0-6M2-11c2-2 2-4 0-6"/></g>
    <g id="icecream" class="line"><path d="M-9-4a9 9 0 1 1 18 0Z"/><path d="M-9-4 0 17 9-4ZM-5 4h10M-2 10h4"/></g>
    <g id="apple" class="line"><path d="M0-8c-8-5-15 2-12 12 2 9 8 12 12 8 4 4 10 1 12-8 3-10-4-17-12-12Z"/><path d="M0-8c1-6 5-8 10-8M0-8c-2-4-5-5-8-5"/></g>
    <g id="donut" class="line"><circle r="13"/><circle r="5"/><path d="M-8-6c4 2 7 0 10-3M4 8c3-2 5-1 8 1M-12 2c4 0 5 3 8 4"/></g>

    <g id="gift" class="line"><rect x="-14" y="-3" width="28" height="18" rx="3"/><rect x="-16" y="-11" width="32" height="8" rx="2"/><path d="M0-11v26M0-11c-7-8-14-2 0 0 14-2 7-8 0 0"/></g>
    <g id="pencil" class="line"><path d="M-17 10 9-16l8 8-26 26-10 2Z"/><path d="M8-15 16-7M-9 18l-8-8"/></g>
    <g id="book" class="line"><path d="M-17-12h13c4 0 6 2 6 6v22c0-4-2-6-6-6h-13ZM2-6c0-4 2-6 6-6h12v22H8c-4 0-6 2-6 6Z"/><path d="M-12-5h7M-12 2h7M7-5h8M7 2h8"/></g>
    <g id="bag" class="line"><path d="M-14-2h28l-2 22h-24Z"/><path d="M-7-2v-5a7 7 0 0 1 14 0v5"/></g>
    <g id="umbrella" class="line"><path d="M-19 2c4-14 34-14 38 0-7-4-12-4-19 0-7-4-12-4-19 0Z"/><path d="M0 2v14c0 6 8 5 8 0"/></g>
    <g id="hat" class="line"><path d="M-18 4c6 6 30 6 36 0"/><path d="M-10 4c0-9 20-9 20 0v2H-10Z"/></g>
    <g id="shirt" class="line"><path d="M-9-15c5 5 13 5 18 0l11 7-6 9-5-3v20H-9V-2l-5 3-6-9Z"/></g>
    <g id="glasses" class="line"><circle cx="-8" r="6"/><circle cx="8" r="6"/><path d="M-2 0h4M-14-1l-5-3M14-1l5-3"/></g>

    <g id="smile" class="line"><circle r="12"/><path d="M-5-4h.1M5-4h.1M-6 4c4 4 8 4 12 0"/></g>
    <g id="face" class="line"><rect x="-13" y="-13" width="26" height="26" rx="6"/><path d="M-5-4h.1M5-4h.1M-6 5c4 3 8 3 12 0"/></g>
    <g id="cat" class="line"><path d="M-12 9V-4l5-7 5 5h4l5-5 5 7V9Z"/><path d="M-5 0h.1M5 0h.1M-3 6c2 2 4 2 6 0M0 2v3M-11 3l-8-2M-11 7l-8 2M11 3l8-2M11 7l8 2"/></g>
    <g id="paw" class="line"><ellipse cy="6" rx="6" ry="5"/><circle cx="-8" cy="-2" r="3"/><circle cx="-2" cy="-6" r="3"/><circle cx="4" cy="-6" r="3"/><circle cx="9" cy="-1" r="3"/></g>
    <g id="bird" class="line"><path d="M-16 4c7-9 16-8 21 0 3-6 8-8 14-7-4 5-8 9-15 13-9 5-15 2-20-6Z"/><path d="M4 4c-5-2-9-2-14 1M12-1h.1"/></g>
    <g id="butterfly" class="line"><path d="M0 0c-6-12-17-10-14 1 2 8 9 8 14-1ZM0 0c6-12 17-10 14 1-2 8-9 8-14-1ZM0 0v13M-4 15c3-3 5-3 8 0"/></g>
    <g id="fish" class="line"><path d="M-15 0c6-8 21-8 30 0-9 8-24 8-30 0Z"/><path d="M15 0 23-7v14ZM-8-2h.1"/></g>
    <g id="shell" class="line"><path d="M-14 9C-12-6-4-15 0-15S12-6 14 9Z"/><path d="M-14 9H14M0-15V9M-8-8-3 9M8-8 3 9"/></g>
    <g id="home" class="line"><path d="M-16 0 0-14 16 0"/><path d="M-12-1v17H12V-1M-4 16V6h8v10"/></g>
  </defs>`

// Approx half-extent (units from origin to the farthest point) per symbol —
// drives target-size normalization and the seamless edge-wrap margins.
const EXT = {
  star: 10, spark: 8, plus: 6, diamond: 8, triangle: 9, ring: 6, dots: 8,
  'tiny-heart': 5, bolt: 11, check: 10, xmark: 7,
  heart: 11, chat: 16, speech: 18, envelope: 18, phone: 14, camera: 16, video: 17,
  laptop: 20, gamepad: 19, tv: 18, watch: 12, bulb: 9, key: 15, lock: 11,
  calendar: 15, clock: 12, magnifier: 13,
  music: 15, 'double-music': 15, headphones: 16, mic: 11, guitar: 17, keyboard: 19,
  drum: 18, record: 13,
  cloud: 16, rain: 16, moon: 13, sun: 16, leaf: 16, flower: 11, tree: 15, palm: 19,
  mountain: 20, rainbow: 19, wave: 20, swirl: 16,
  planet: 19, rocket: 18, 'paper-plane': 16, airplane: 21, balloon: 12, compass: 13,
  suitcase: 16, 'map-pin': 12, car: 19, bike: 16, train: 15, ship: 19,
  burger: 18, pizza: 17, cup: 12, icecream: 10, apple: 12, donut: 13,
  gift: 16, pencil: 17, book: 17, bag: 14, umbrella: 19, hat: 18, shirt: 20, glasses: 14,
  smile: 12, face: 13, cat: 12, paw: 9, bird: 16, butterfly: 14, fish: 15, shell: 14, home: 16,
}

const TINY = ['star', 'spark', 'plus', 'diamond', 'ring', 'dots', 'tiny-heart', 'bolt', 'check', 'xmark', 'triangle', 'heart']
const ANCHORS = ['headphones', 'guitar', 'camera', 'planet', 'flower', 'sun', 'cloud', 'keyboard', 'rocket', 'tv', 'burger', 'umbrella', 'drum', 'record', 'train', 'car', 'tree', 'speech', 'book', 'pizza', 'gift', 'laptop', 'mountain', 'ship', 'bike']
const DETAILED = Object.keys(EXT).filter((id) => !['star', 'spark', 'plus', 'diamond', 'ring', 'dots', 'tiny-heart', 'bolt', 'check', 'xmark', 'triangle'].includes(id))
const SMALL_POOL = DETAILED.concat(['heart', 'ring', 'star', 'diamond', 'tiny-heart', 'spark'])

// ── Seeded RNG (deterministic output) ───────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260710)
const rand = (a, b) => a + (b - a) * rng()
const pick = (arr) => arr[Math.floor(rng() * arr.length)]

// The tile is a 600u viewBox painted at background-size 450px → 0.75 screen-px/u.
// Visible size (px) of a symbol = ext * scale * 2 * 0.75 = ext * scale * 1.5.
const TILE = 600
const PXU = 1.5 // screen px per (ext * scale) unit
const uses = []

function place(id, x, y, targetPx, rotRange, mirrorProb) {
  const ext = EXT[id] || 14
  const scale = targetPx / (ext * PXU)
  const rot = rand(-rotRange, rotRange)
  const mirror = rng() < mirrorProb
  uses.push({ id, x, y, scale, rot, mirror, ext })
}

// ── 1. Extra-large anchors, Poisson-spaced, each wrapped in a dense cluster ──
const anchors = []
let attempts = 0
while (anchors.length < 8 && attempts < 4000) {
  attempts++
  const x = rand(20, TILE - 20)
  const y = rand(20, TILE - 20)
  if (anchors.every((a) => Math.hypot(a.x - x, a.y - y) > 188)) anchors.push({ x, y })
}
for (const a of anchors) {
  const id = pick(ANCHORS)
  const px = rand(96, 140)
  place(id, a.x, a.y, px, 12, 0.25)
  const half = px / PXU // anchor visible half-size in units

  // A couple of large/medium companions hugging the anchor.
  const nLarge = 2 + Math.floor(rng() * 2)
  for (let i = 0; i < nLarge; i++) {
    const ang = rand(0, Math.PI * 2)
    const d = half * rand(0.85, 1.5)
    place(pick(DETAILED), a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, rand(42, 70), 26, 0.4)
  }
  // A scatter of small marks filling the ring.
  const nSmall = 3 + Math.floor(rng() * 3)
  for (let i = 0; i < nSmall; i++) {
    const ang = rand(0, Math.PI * 2)
    const d = half * rand(0.7, 1.75)
    place(pick(SMALL_POOL), a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, rand(20, 36), 50, 0.5)
  }
  // Tiny fillers wedged into the negative space around it.
  const nTiny = 4 + Math.floor(rng() * 4)
  for (let i = 0; i < nTiny; i++) {
    const ang = rand(0, Math.PI * 2)
    const d = half * rand(0.55, 1.95)
    place(pick(TINY), a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, rand(8, 20), 85, 0.5)
  }
}

// ── 2. Global scatter fill so no region reads as empty (positions run past the
//        edges on purpose; the wrap step below continues them on the far side) ─
for (let i = 0; i < 16; i++) place(pick(DETAILED), rand(-24, TILE + 24), rand(-24, TILE + 24), rand(38, 62), 26, 0.35)
for (let i = 0; i < 20; i++) place(pick(SMALL_POOL), rand(-24, TILE + 24), rand(-24, TILE + 24), rand(20, 37), 55, 0.5)
for (let i = 0; i < 24; i++) place(pick(TINY), rand(-24, TILE + 24), rand(-24, TILE + 24), rand(8, 20), 90, 0.5)

// ── 3. Seamless edge wrap: any object crossing an edge is repeated on the far
//        side (and the diagonal corner) so the tile repeats with no visible seam ─
function wrap(list) {
  const out = []
  for (const u of list) {
    const m = u.ext * u.scale
    const xs = [u.x]
    if (u.x - m < 0) xs.push(u.x + TILE)
    if (u.x + m > TILE) xs.push(u.x - TILE)
    const ys = [u.y]
    if (u.y - m < 0) ys.push(u.y + TILE)
    if (u.y + m > TILE) ys.push(u.y - TILE)
    for (const X of xs) for (const Y of ys) out.push({ ...u, x: X, y: Y })
  }
  // Keep only copies that actually intersect the tile box (drop fully-outside originals).
  return out.filter((u) => {
    const m = u.ext * u.scale
    return u.x + m > 0 && u.x - m < TILE && u.y + m > 0 && u.y - m < TILE
  })
}

const final = wrap(uses)

// ── Emit ────────────────────────────────────────────────────────────────────
const f = (n) => (Math.round(n * 10) / 10).toString()
const lines = final.map((u) => {
  const s = f(u.scale)
  const sx = u.mirror ? '-' + s : s
  return `    <use href="#${u.id}" transform="translate(${f(u.x)} ${f(u.y)}) rotate(${f(u.rot)}) scale(${sx} ${s})"/>`
})

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
${DEFS}

  <rect width="600" height="600" fill="none"/>

  <g class="line">
${lines.join('\n')}
  </g>
</svg>
`

const out = process.argv[2] || path.join(__dirname, '..', 'public', 'chat-doodle-wallpaper.svg')
fs.writeFileSync(out, svg)
console.error(`wrote ${out} — base placements: ${uses.length}, rendered (after wrap): ${final.length}`)
