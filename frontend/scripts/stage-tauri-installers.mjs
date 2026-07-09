import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundleRoot = resolve(
  frontendRoot,
  'src-tauri',
  'target',
  'release',
  'bundle',
)
const s3Bucket = process.env.INSTALLER_S3_BUCKET
const s3Prefix = (process.env.INSTALLER_S3_PREFIX || 'downloads').replace(/^\/|\/$/g, '')
const tauriConf = JSON.parse(
  readFileSync(resolve(frontendRoot, 'src-tauri', 'tauri.conf.json'), 'utf-8'),
)
const appVersion = tauriConf.version

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
          destinations: [
            'not-spotify-windows-x64-setup.exe',
            `not-spotify_${appVersion}_x64-setup.exe`,
          ],
        },
        {
          source: newestFile('msi', '.msi'),
          destinations: [
            'not-spotify-windows-x64.msi',
            `not-spotify_${appVersion}_x64_en-US.msi`,
          ],
        },
      ]
    : process.platform === 'darwin'
      ? [
          {
            source: newestFile('dmg', '.dmg'),
            destinations: [`not-spotify-macos-${process.arch}.dmg`],
          },
        ]
      : [
          {
            source: newestFile('appimage', '.AppImage'),
            destinations: [`not-spotify-linux-${process.arch}.AppImage`],
          },
          {
            source: newestFile('deb', '.deb'),
            destinations: [`not-spotify-linux-${process.arch}.deb`],
          },
        ]

for (const { source, destinations } of targets) {
  for (const destination of destinations) {
    if (!s3Bucket) {
      console.log(
        `Built ${relative(frontendRoot, source)}; set INSTALLER_S3_BUCKET to upload ${destination}.`,
      )
      continue
    }

    const s3Target = `s3://${s3Bucket}/${s3Prefix}/${destination}`
    const result = spawnSync(
      'aws',
      [
        's3',
        'cp',
        source,
        s3Target,
        '--cache-control',
        'public,max-age=86400',
        '--content-disposition',
        `attachment; filename="${destination}"`,
      ],
      { stdio: 'inherit' },
    )

    if (result.status !== 0) {
      throw new Error(`Failed to upload ${destination} to ${s3Target}`)
    }

    console.log(`Uploaded ${source} -> ${s3Target}`)
  }
}
