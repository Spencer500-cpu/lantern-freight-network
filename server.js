import { createServer } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marketplaceApi } from './marketplace-api.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(here, 'dist')
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' }

const server = createServer(async (req, res) => {
  if (new URL(req.url || '/', 'http://localhost').pathname.startsWith('/api/')) {
    await marketplaceApi(req, res, () => { res.statusCode = 404; res.end('Not found') })
    return
  }
  const requested = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '')
  let filePath = path.resolve(distPath, relative)
  if (!filePath.startsWith(`${distPath}${path.sep}`) && filePath !== path.join(distPath, 'index.html')) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }
  try {
    const contents = await fs.readFile(filePath)
    res.setHeader('Content-Type', mimeTypes[path.extname(filePath)] || 'application/octet-stream')
    res.end(contents)
  } catch {
    const contents = await fs.readFile(path.join(distPath, 'index.html'))
    res.setHeader('Content-Type', mimeTypes['.html'])
    res.end(contents)
  }
})

const port = Number(process.env.PORT || 4173)
server.listen(port, '0.0.0.0', () => console.log(`Lantern Solutions listening at http://localhost:${port}`))
