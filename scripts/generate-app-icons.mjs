/**
 * Resizes `public/icons/app-icon-master.png` into PWA / Android / favicon / Apple sizes.
 * Run: npm run icons:generate
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const masterPath = path.join(root, 'public', 'icons', 'app-icon-master.png');

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
];

async function main() {
  if (!fs.existsSync(masterPath)) {
    console.error('Missing', masterPath);
    process.exit(1);
  }

  const iconsDir = path.join(root, 'public', 'icons');
  for (const [name, size] of targets) {
    await sharp(masterPath).resize(size, size, { fit: 'cover' }).png().toFile(path.join(iconsDir, name));
    console.log('wrote', path.join('public', 'icons', name));
  }

  await sharp(masterPath).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(root, 'public', 'icon-512.png'));
  console.log('wrote public/icon-512.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
