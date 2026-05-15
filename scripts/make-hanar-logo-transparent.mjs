/**
 * Remove checkerboard / light neutral OR solid black studio backdrops from edges,
 * write PNG with alpha. Default output: public/hanar.logo.png
 *
 * Usage:
 *   node scripts/make-hanar-logo-transparent.mjs [inputPath] [outputPath]
 *   node scripts/make-hanar-logo-transparent.mjs --whiten-only [pathUnderRepoOrAbs]
 *     (rewrites file in place: pure white RGB, alpha preserved, sub-floor alpha → transparent)
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const INPUT =
  process.argv[2] ||
  'C:/Users/dfarr/.cursor/projects/c-Users-dfarr-hanar-frontend/assets/c__Users_dfarr_AppData_Roaming_Cursor_User_workspaceStorage_5cac0a481bc19684f2436b9fb0adf391_images_Gemini_Generated_Image_wrfo7vwrfo7vwrfo-086a5e24-aedc-44ce-8493-c929a8d542a1.png';
const OUTPUT = process.argv[3] || path.join(ROOT, 'public', 'hanar.logo.png');

function isBackdrop(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d > 32) return false;
  // Off-white / checker light squares only — never pure white (255,255,255); logo art is white on black exports.
  if (r >= 248 && g >= 248 && b >= 248) {
    if (r === 255 && g === 255 && b === 255) return false;
    return true;
  }
  if (r >= 168 && r <= 222 && g >= 168 && g <= 222 && b >= 168 && b <= 222) return true;
  if (max >= 215 && min >= 185 && d <= 25) return true;
  return false;
}

/** Solid black / near-black studio backdrops (flood from edges). */
function isBlackBackdrop(r, g, b) {
  return r <= 58 && g <= 58 && b <= 58;
}

function shouldMakeTransparent(r, g, b) {
  return isBackdrop(r, g, b) || isBlackBackdrop(r, g, b);
}

/**
 * After matting: leftover RGB is often grey (old anti-alias on black). On a black UI chip that reads as
 * muddy "dots". Drop very-low-alpha noise, then force surviving pixels to pure white while keeping alpha
 * for smooth edges on black backgrounds.
 */
function whitenForegroundRgba(out, alphaFloor = 22) {
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a < alphaFloor) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    } else {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
    }
  }
}

async function whitenOnlyFile(absPath) {
  if (!fs.existsSync(absPath)) {
    console.error('Input not found:', absPath);
    process.exit(1);
  }
  const { data, info } = await sharp(absPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error('expected RGBA');
  const out = Buffer.from(data);
  whitenForegroundRgba(out, 22);
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(absPath);
  console.log('Whitened', absPath, `${info.width}x${info.height}`);
}

async function main() {
  if (process.argv[2] === '--whiten-only') {
    const rel = process.argv[3] || 'public/hanar-business-logo.png';
    await whitenOnlyFile(path.isAbsolute(rel) ? rel : path.join(ROOT, rel));
    return;
  }

  if (!fs.existsSync(INPUT)) {
    console.error('Input not found:', INPUT);
    process.exit(1);
  }

  const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  if (ch !== 4) throw new Error('expected RGBA');

  const out = Buffer.from(data);
  const visited = new Uint8Array(w * h);

  const idx = (x, y) => (y * w + x) * 4;
  const q = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (visited[i]) return;
    const j = idx(x, y);
    const r = out[j],
      g = out[j + 1],
      b = out[j + 2];
    if (!shouldMakeTransparent(r, g, b)) return;
    visited[i] = 1;
    out[j + 3] = 0;
    q.push(x, y);
  };

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  while (q.length) {
    const y = q.pop();
    const x = q.pop();
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  whitenForegroundRgba(out, 22);

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(OUTPUT);

  console.log('Wrote', OUTPUT, `${w}x${h}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
