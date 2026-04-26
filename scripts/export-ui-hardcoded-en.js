const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.join(process.cwd(), 'utils', 'translations.ts');
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'data', 'ui-hardcoded-texts.en.json');

function extractEnBlock(source) {
  const markerIndex = source.indexOf('"en": {');
  if (markerIndex < 0) {
    throw new Error('Could not locate English translation block in utils/translations.ts');
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
    throw new Error('Could not determine end of English translation block');
  }

  const objectBody = source.slice(start + 1, end);
  return new Function(`return ({${objectBody}});`)();
}

function main() {
  const source = fs.readFileSync(SOURCE_FILE, 'utf8');
  const englishMap = extractEnBlock(source);

  // Skip obvious admin-only entries to align with "skip admin panel pages".
  const filtered = Object.fromEntries(
    Object.entries(englishMap).filter(
      ([key, value]) =>
        !/\badmin\b/i.test(String(key)) &&
        !/\badmin\b/i.test(String(value))
    )
  );

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'utils/translations.ts',
    locale: 'en',
    note: 'English UI strings export with admin-labelled entries filtered out.',
    count: Object.keys(filtered).length,
    texts: filtered,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Exported ${output.count} English strings to ${OUTPUT_FILE}`);
}

main();
