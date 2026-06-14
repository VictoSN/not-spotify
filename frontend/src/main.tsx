import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/montserrat/index.css'
import './index.css'
import App from './App.tsx'
import '@/services/audioEngine'
import { registerServiceWorker } from '@/utils/registerSW'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
