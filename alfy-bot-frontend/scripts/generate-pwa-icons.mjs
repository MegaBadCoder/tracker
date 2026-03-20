import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const svg = readFileSync(join(publicDir, 'pwa-icon.svg'))

async function writePng(name, size) {
  await sharp(svg).resize(size, size).png().toFile(join(publicDir, name))
}

await writePng('pwa-192x192.png', 192)
await writePng('pwa-512x512.png', 512)
await sharp(svg).resize(512, 512).png().toFile(join(publicDir, 'pwa-maskable.png'))

console.log('PWA icons written to public/')
