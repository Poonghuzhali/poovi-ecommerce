import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Restore route after GitHub Pages 404 redirect
const params = new URLSearchParams(window.location.search)
const route = params.get('p')
if (route) {
  const query = params.get('q')
  const restored = route + (query ? '?' + query.replace(/~and~/g, '&') : '') + window.location.hash
  window.history.replaceState(null, '', restored)
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
