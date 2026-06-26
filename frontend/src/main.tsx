import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/montserrat/index.css'
import './index.css'
import App from './App.tsx'
import '@/services/audioEngine'
import { initAppZoom } from '@/services/appZoom'
import { registerServiceWorker } from '@/utils/registerSW'

initAppZoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
