/**
 * Génère les icônes PWA (PNG) sans dépendance externe.
 * Motif : carré anthracite arrondi + barres façon égaliseur en couleur d'accent.
 *
 * Utilisation : node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "public", "icons");

const BACKGROUND = [16, 16, 20, 255];
const ACCENT = [139, 92, 246, 255];
const ACCENT_DIM = [109, 72, 200, 255];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur de bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Chaque ligne est préfixée par son type de filtre (0 = aucun).
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Distance au bord d'un rectangle arrondi, pour un anticrénelage simple. */
function roundedRectCoverage(x, y, left, top, right, bottom, radius) {
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (x < left || x > right || y < top || y > bottom) return 0;
  return Math.max(0, Math.min(1, radius - distance + 0.5));
}

function blend(target, offset, color, alpha) {
  for (let c = 0; c < 3; c += 1) {
    target[offset + c] = Math.round(target[offset + c] * (1 - alpha) + color[c] * alpha);
  }
  target[offset + 3] = 255;
}

function drawIcon(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);

  // Fond : plein pour maskable (zone de sécurité), arrondi sinon.
  const radius = maskable ? 0 : size * 0.22;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const coverage = maskable
        ? 1
        : roundedRectCoverage(x + 0.5, y + 0.5, 0, 0, size - 1, size - 1, radius);
      pixels[offset] = BACKGROUND[0];
      pixels[offset + 1] = BACKGROUND[1];
      pixels[offset + 2] = BACKGROUND[2];
      pixels[offset + 3] = Math.round(255 * coverage);
    }
  }

  // Barres d'égaliseur : hauteurs relatives, centrées.
  const heights = [0.34, 0.62, 0.92, 0.5, 0.74];
  const inset = maskable ? size * 0.28 : size * 0.22;
  const usable = size - inset * 2;
  const gap = usable * 0.075;
  const barWidth = (usable - gap * (heights.length - 1)) / heights.length;
  const barRadius = barWidth / 2;
  const centerY = size / 2;

  heights.forEach((ratio, index) => {
    const left = inset + index * (barWidth + gap);
    const right = left + barWidth;
    const half = (usable * ratio) / 2;
    const top = centerY - half;
    const bottom = centerY + half;
    const color = index % 2 === 0 ? ACCENT : ACCENT_DIM;

    for (let y = Math.floor(top); y <= Math.ceil(bottom); y += 1) {
      if (y < 0 || y >= size) continue;
      for (let x = Math.floor(left); x <= Math.ceil(right); x += 1) {
        if (x < 0 || x >= size) continue;
        const coverage = roundedRectCoverage(x + 0.5, y + 0.5, left, top, right, bottom, barRadius);
        if (coverage <= 0) continue;
        blend(pixels, (y * size + x) * 4, color, coverage);
      }
    }
  });

  return encodePng(size, size, pixels);
}

mkdirSync(outDir, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: true },
];

for (const target of targets) {
  const png = drawIcon(target.size, { maskable: target.maskable });
  writeFileSync(resolve(outDir, target.name), png);
  console.log(`✓ ${target.name} (${target.size}×${target.size})`);
}

// Favicon 32×32 réutilisé tel quel par le navigateur.
writeFileSync(resolve(here, "..", "public", "favicon.png"), drawIcon(32));
console.log("✓ favicon.png (32×32)");
