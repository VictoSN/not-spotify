import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/montserrat/index.css'
import './index.css'
import App from './App.tsx'
import { AuthSessionBridgePage } from '@/pages/AuthSessionBridgePage'
import '@/services/audioEngine'
import { initAppZoom } from '@/services/appZoom'
import { registerServiceWorker } from '@/utils/registerSW'

initAppZoom()

const isSessionBridge = window.location.pathname === '/auth/session-bridge'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSessionBridge ? <AuthSessionBridgePage /> : <App />}
  </StrictMode>,
)

if (!isSessionBridge) registerServiceWorker()
