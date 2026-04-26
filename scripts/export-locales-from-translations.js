const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.join(process.cwd(), 'utils', 'translations.ts');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'locales');

function extractTranslationsObject(source) {
  const marker = 'const translations: Record<string, Record<string, string>> = {';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Could not find translations object in utils/translations.ts');
  }

  const start = source.indexOf('{', markerIndex);
  let depth = 0;
  let end = -1;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error('Could not determine end of translations object');
  }

  const objectBody = source.slice(start + 1, end);
  return new Function(`return ({${objectBody}});`)();
}

function main() {
  const source = fs.readFileSync(SOURCE_FILE, 'utf8');
  const translations = extractTranslationsObject(source);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const locales = Object.keys(translations);
  let exportedCount = 0;

  locales.forEach((locale) => {
    const payload = translations[locale] || {};
    const outputPath = path.join(OUTPUT_DIR, `${locale}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n');
    exportedCount += 1;
  });

  console.log(`Exported ${exportedCount} locale files to ${OUTPUT_DIR}`);
}

main();
