import { assetUrl } from './assets'

/**
 * Circular Std — Spotify's typeface — is served from S3 (app-assets/) through the
 * storage proxy, not bundled into the JS/CSS. The binaries are proprietary and stay
 * out of git (frontend/src/assets/fonts is .gitignored); `dotnet run -- upload-app-assets`
 * pushes them to the bucket.
 *
 * The @font-face `src` therefore has to point at the runtime API base (VITE_API_URL),
 * which CSS can't read — so we build the rules here from the same assetUrl() base the
 * rest of the app uses and inject them once. Montserrat stays bundled as the fallback
 * face (see --font-sans) so text renders immediately while these swap in.
 */
const FONT_DIR = 'frontend/src/assets/fonts/circular'

// Circular Std ships four faces; map each to the weight range it should cover so the
// app's weight tokens (450/500/575/675/750) resolve to the nearest real face.
const FACES: ReadonlyArray<{ file: string; weight: string }> = [
  { file: 'CircularStd-Book.ttf', weight: '400 460' }, // normal (450)
  { file: 'CircularStd-Medium.ttf', weight: '461 560' }, // medium (500)
  { file: 'CircularStd-Bold.ttf', weight: '561 720' }, // semibold/bold (575, 675)
  { file: 'CircularStd-Black.ttf', weight: '721 900' }, // black (750)
]

const css = FACES.map(
  ({ file, weight }) => `@font-face {
  font-family: 'Circular Std';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('${assetUrl(`${FONT_DIR}/${file}`)}') format('truetype');
}`,
).join('\n')

const style = document.createElement('style')
style.dataset.font = 'circular-std'
style.textContent = css
document.head.appendChild(style)
