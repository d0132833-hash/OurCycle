import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Generates the PWA icon set from a heart-on-gradient SVG (no external assets).

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url))
const APPLE_OUT = fileURLToPath(new URL('../public/apple-touch-icon.png', import.meta.url))

const HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'

function svg({ size, rx, scale, tx, ty }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FDF2F4"/>
      <stop offset="1" stop-color="#FFE3D0"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#g)"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <path d="${HEART_PATH}" fill="#E11D48"/>
  </g>
</svg>`
}

async function main() {
  await mkdir(OUT, { recursive: true })

  // Regular icons: rounded-square, heart ~52% of canvas
  const icon512 = svg({ size: 512, rx: 112, scale: 12.6, tx: 104, ty: 96 })
  // Maskable: full-bleed square, heart inside the 80% safe zone
  const maskable512 = svg({ size: 512, rx: 0, scale: 10.2, tx: 138, ty: 128 })
  // Apple touch: full-bleed (iOS applies its own mask)
  const apple = svg({ size: 512, rx: 0, scale: 11.6, tx: 116, ty: 106 })

  await sharp(Buffer.from(icon512)).png().toFile(path.join(OUT, 'icon-512.png'))
  await sharp(Buffer.from(icon512)).resize(192, 192).png().toFile(path.join(OUT, 'icon-192.png'))
  await sharp(Buffer.from(maskable512)).png().toFile(path.join(OUT, 'maskable-512.png'))
  await sharp(Buffer.from(apple)).resize(180, 180).png().toFile(APPLE_OUT)

  console.log('icons written to public/icons + public/apple-touch-icon.png')
}

main()
