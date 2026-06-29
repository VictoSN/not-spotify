import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(frontendRoot, '..')
const bundleRoot = resolve(
  frontendRoot,
  'src-tauri',
  'target',
  'release',
  'bundle',
)
const downloadsRoot = resolve(
  repoRoot,
  'backend',
  'src',
  'NotSpotify.Api',
  'wwwroot',
  'downloads',
)

function newestFile(folder, extension) {
  const directory = resolve(bundleRoot, folder)
  const candidates = readdirSync(directory)
    .filter((name) => extname(name).toLowerCase() === extension.toLowerCase())
    .map((name) => resolve(directory, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)

  if (!candidates[0])
    throw new Error(`No ${extension} installer found in ${directory}`)
  return candidates[0]
}

const targets =
  process.platform === 'win32'
    ? [
        {
          source: newestFile('nsis', '.exe'),
          destination: 'not-spotify-windows-x64-setup.exe',
        },
        {
          source: newestFile('msi', '.msi'),
          destination: 'not-spotify-windows-x64.msi',
        },
      ]
    : process.platform === 'darwin'
      ? [
          {
            source: newestFile('dmg', '.dmg'),
            destination: `not-spotify-macos-${process.arch}.dmg`,
          },
        ]
      : [
          {
            source: newestFile('appimage', '.AppImage'),
            destination: `not-spotify-linux-${process.arch}.AppImage`,
          },
          {
            source: newestFile('deb', '.deb'),
            destination: `not-spotify-linux-${process.arch}.deb`,
          },
        ]

mkdirSync(downloadsRoot, { recursive: true })
for (const { source, destination } of targets) {
  const output = resolve(downloadsRoot, destination)
  copyFileSync(source, output)
  console.log(`Staged ${source} -> ${output}`)
}
