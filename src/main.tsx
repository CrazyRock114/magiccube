/// <reference types="vite/client" />
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Diagnostic: surface any error during initial mount
window.addEventListener('error', e => {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<pre style="color:red;padding:16px;font-family:monospace;white-space:pre-wrap">${e.error?.stack || e.message}</pre>`
  }
})
window.addEventListener('unhandledrejection', e => {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<pre style="color:orange;padding:16px;font-family:monospace;white-space:pre-wrap">REJECTED: ${e.reason?.stack || e.reason}</pre>`
  }
})

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
} catch (e: any) {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<pre style="color:red;padding:16px;font-family:monospace;white-space:pre-wrap">CATCH: ${e?.stack || e}</pre>`
  }
}
