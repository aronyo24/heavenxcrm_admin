import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// After a new deploy, an open tab may still reference page chunks that no
// longer exist on the server. Reload to pick up the new build instead of
// showing a blank page - at most once every 30 seconds, so a chunk that is
// really missing can't cause a reload loop.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'hx-chunk-reload-at'
  try {
    const last = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - last < 30_000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
