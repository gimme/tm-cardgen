import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { initApp } from './app/init.ts'
import { useStore } from './app/store/useStore.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

initApp().catch((err: unknown) => {
  console.error(err)
  useStore.setState({ startupError: String(err) })
})
