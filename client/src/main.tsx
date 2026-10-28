import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './base.css'
import App from './MysteryApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
