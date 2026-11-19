import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// GitHub Pages: el 404.html guarda la ruta pedida y la restauramos aquí (ver public/404.html).
const pendiente = sessionStorage.getItem('ruta-pendiente')
if (pendiente) {
  sessionStorage.removeItem('ruta-pendiente')
  history.replaceState(null, '', pendiente)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
