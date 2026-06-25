// DEPRECATED: icon generation is now done via `npx tauri icon ./app-icon.svg`
// which regenerates all sizes in src-tauri/icons/ in one step.
// After running tauri icon, sync the PWA icons:
//   cp src-tauri/icons/icon.png        public/icons/icon-512.png
//   cp src-tauri/icons/128x128.png     public/icons/icon-192.png
//   cp src-tauri/icons/icon.png        public/icons/icon-maskable-512.png
// The script below is kept as a fallback for ICO-only regeneration.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pwaIcons = join(here, '..', '..', 'public', 'icons');

// icon.png — master PNG for the bundler (copy of the 512 PWA icon).
writeFileSync(join(here, 'icon.png'), readFileSync(join(pwaIcons, 'icon-512.png')));

// icon.ico — wrap the 192px PNG in a single-image ICO container.
const png = readFileSync(join(pwaIcons, 'icon-192.png'));
const size = 192; // both source dimensions; fits the ICO 1-byte field

const ICONDIR = Buffer.alloc(6);
ICONDIR.writeUInt16LE(0, 0); // reserved
ICONDIR.writeUInt16LE(1, 2); // type: 1 = icon
ICONDIR.writeUInt16LE(1, 4); // image count

const ICONDIRENTRY = Buffer.alloc(16);
ICONDIRENTRY.writeUInt8(size, 0); // width
ICONDIRENTRY.writeUInt8(size, 1); // height
ICONDIRENTRY.writeUInt8(0, 2); // palette colors (0 = none)
ICONDIRENTRY.writeUInt8(0, 3); // reserved
ICONDIRENTRY.writeUInt16LE(1, 4); // color planes
ICONDIRENTRY.writeUInt16LE(32, 6); // bits per pixel
ICONDIRENTRY.writeUInt32LE(png.length, 8); // size of image data
ICONDIRENTRY.writeUInt32LE(6 + 16, 12); // offset to image data

writeFileSync(join(here, 'icon.ico'), Buffer.concat([ICONDIR, ICONDIRENTRY, png]));

console.log('Wrote icon.png and icon.ico');
