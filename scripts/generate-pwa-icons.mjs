import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ICONS_DIR = path.resolve('public/icons')
fs.mkdirSync(ICONS_DIR, { recursive: true })

// 512x512 standard icon SVG
const standardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="60%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#050811" />
    </radialGradient>
    <linearGradient id="neonCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <linearGradient id="accentGlow" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#60a5fa" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="512" height="512" rx="112" fill="url(#bgGlow)" />
  <rect width="510" height="510" x="1" y="1" rx="111" fill="none" stroke="url(#neonCyan)" stroke-width="2.5" stroke-opacity="0.4" />

  <!-- Outer Cyber Shield / Crest -->
  <path d="M256 60 L390 120 V250 C390 340 330 405 256 445 C182 405 122 340 122 250 V120 Z" 
        fill="#0b1120" stroke="url(#neonCyan)" stroke-width="8" stroke-linejoin="round" opacity="0.9" />

  <!-- Inner Aura Background -->
  <path d="M256 82 L368 132 V242 C368 318 318 375 256 410 C194 375 144 318 144 242 V132 Z" 
        fill="url(#neonCyan)" fill-opacity="0.12" />

  <!-- Hunter Level-Up Chevrons / Wings -->
  <path d="M256 140 L340 215 L320 232 L256 178 L192 232 L172 215 Z" 
        fill="url(#accentGlow)" filter="url(#glow)" />
  <path d="M256 195 L325 256 L308 270 L256 226 L204 270 L187 256 Z" 
        fill="url(#neonCyan)" opacity="0.8" />

  <!-- Core Diamond / Awakening Gate Center -->
  <polygon points="256,238 296,286 256,334 216,286" fill="#38bdf8" filter="url(#glow)" />
  <polygon points="256,252 284,286 256,320 228,286" fill="#ffffff" />

  <!-- Lower Tech Accents -->
  <circle cx="256" cy="370" r="6" fill="#38bdf8" />
  <path d="M236 385 L256 398 L276 385" fill="none" stroke="url(#neonCyan)" stroke-width="3" stroke-linecap="round" />
</svg>`

// Maskable icon SVG (content inside 80% safe zone, square background)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bgGlowM" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="65%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#050811" />
    </radialGradient>
    <linearGradient id="neonCyanM" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <linearGradient id="accentGlowM" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#60a5fa" />
    </linearGradient>
    <filter id="glowM" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Full bleed background for maskable icon -->
  <rect width="512" height="512" fill="url(#bgGlowM)" />

  <!-- Content scaled inside 80% circle (center: 256, radius: 200) -->
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <!-- Outer Cyber Shield / Crest -->
    <path d="M256 60 L390 120 V250 C390 340 330 405 256 445 C182 405 122 340 122 250 V120 Z" 
          fill="#0b1120" stroke="url(#neonCyanM)" stroke-width="10" stroke-linejoin="round" />

    <!-- Inner Aura Background -->
    <path d="M256 82 L368 132 V242 C368 318 318 375 256 410 C194 375 144 318 144 242 V132 Z" 
          fill="url(#neonCyanM)" fill-opacity="0.16" />

    <!-- Hunter Level-Up Chevrons / Wings -->
    <path d="M256 140 L340 215 L320 232 L256 178 L192 232 L172 215 Z" 
          fill="url(#accentGlowM)" filter="url(#glowM)" />
    <path d="M256 195 L325 256 L308 270 L256 226 L204 270 L187 256 Z" 
          fill="url(#neonCyanM)" opacity="0.8" />

    <!-- Core Diamond / Awakening Gate Center -->
    <polygon points="256,238 296,286 256,334 216,286" fill="#38bdf8" filter="url(#glowM)" />
    <polygon points="256,252 284,286 256,320 228,286" fill="#ffffff" />

    <!-- Lower Tech Accents -->
    <circle cx="256" cy="370" r="8" fill="#38bdf8" />
    <path d="M236 385 L256 398 L276 385" fill="none" stroke="url(#neonCyanM)" stroke-width="4" stroke-linecap="round" />
  </g>
</svg>`

fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), standardSvg)
fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable.svg'), maskableSvg)

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512]

for (const size of sizes) {
  const dest = path.join(ICONS_DIR, `icon-${size}x${size}.png`)
  execSync(`magick -density 300 "${path.join(ICONS_DIR, 'icon.svg')}" -resize ${size}x${size} "${dest}"`)
  console.log(`Generated ${dest}`)
}

// Apple touch icon (180x180)
execSync(`magick -density 300 "${path.join(ICONS_DIR, 'icon.svg')}" -resize 180x180 "${path.join(ICONS_DIR, 'apple-touch-icon.png')}"`)
console.log('Generated apple-touch-icon.png')

// Maskable icons
for (const size of [192, 512]) {
  const dest = path.join(ICONS_DIR, `icon-maskable-${size}x${size}.png`)
  execSync(`magick -density 300 "${path.join(ICONS_DIR, 'icon-maskable.svg')}" -resize ${size}x${size} "${dest}"`)
  console.log(`Generated ${dest}`)
}

// Also create a favicon in public
execSync(`magick -density 300 "${path.join(ICONS_DIR, 'icon.svg')}" -resize 64x64 "public/favicon.ico"`)
console.log('Generated public/favicon.ico')

console.log('All icons generated successfully!')
