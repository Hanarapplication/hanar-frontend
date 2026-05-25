import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const langIndices = JSON.parse(
  fs.readFileSync(path.join(root, 'public/data/seed_author_indices_by_language.json'), 'utf8')
);

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'public/data/community_seed_all_languages_questions.json',
      'public/data/community_seed_all_languages_questions_batch2.json',
      'public/data/community_seed_immigrant_posts.json',
    ];

function checkPosts(posts, file) {
  const issues = [];
  for (let pi = 0; pi < posts.length; pi++) {
    const p = posts[pi];
    const allowed = langIndices[p.language];
    if (!allowed?.length) {
      issues.push({ file, pi, type: 'unknown-lang', lang: p.language });
      continue;
    }
    if (!allowed.includes(p.authorIndex)) {
      issues.push({ file, pi, type: 'post-lang', lang: p.language, authorIndex: p.authorIndex, allowed });
    }
    for (let ci = 0; ci < (p.comments || []).length; ci++) {
      const c = p.comments[ci];
      if (!allowed.includes(c.authorIndex)) {
        issues.push({ file, pi, ci, type: 'comment-lang', lang: p.language, authorIndex: c.authorIndex });
      }
      if (c.authorIndex === p.authorIndex) {
        issues.push({ file, pi, ci, type: 'self-comment', authorIndex: p.authorIndex, lang: p.language });
      }
    }
  }
  return issues;
}

let total = 0;
for (const rel of files) {
  const file = path.join(root, rel);
  const posts = JSON.parse(fs.readFileSync(file, 'utf8'));
  const issues = checkPosts(posts, rel);
  total += issues.length;
  console.log(`${rel}: ${issues.length} issue(s)`);
  for (const issue of issues) {
    console.log(' ', JSON.stringify(issue));
  }
}
process.exit(total > 0 ? 1 : 0);
