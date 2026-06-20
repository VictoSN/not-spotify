// Generates the Tauri icon set from the existing PWA icons in ../../public/icons.
//
// We have no image-resize tooling (ImageMagick / sharp) in this repo, so instead
// of rasterising new sizes we reuse the PWA PNGs as-is:
//   - icon.png  <- icon-512.png  (square master used by the bundler)
//   - icon.ico  <- icon-192.png  wrapped in an ICO container
//
// The ICO format (Vista+) lets us embed a PNG directly: the directory entry just
// points at the raw PNG bytes. 192 fits the 1-byte width/height field, so no
// resize is needed. Re-run with `node generate-icons.mjs` if the source art changes.
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
