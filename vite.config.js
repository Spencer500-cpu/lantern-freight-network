import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { marketplaceApi } from './marketplace-api.js'

export default defineConfig({ plugins: [react(), tailwindcss(), { name: 'lantern-public-marketplace-api', configureServer(server) {
  server.middlewares.use((req, res, next) => {
    let pathname = ''
    try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname) } catch {}
    if (pathname.endsWith('/.lantern-admin-setup-key') || pathname.startsWith('/data/proofs/')) { res.statusCode = 404; res.end('Not found'); return }
    next()
  })
  server.middlewares.use(marketplaceApi)
} }] })
