import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const langIndices = JSON.parse(
  fs.readFileSync(path.join(root, 'public/data/seed_author_indices_by_language.json'), 'utf8')
);

/** Post author from language pool; comments use other profiles (never self). */
export function assignSeedAuthors(lang, commentCount, authorSlot = 0) {
  const indices = langIndices[lang];
  if (!indices?.length) {
    throw new Error(`No author indices for language "${lang}"`);
  }
  const authorIndex = indices[authorSlot % indices.length];
  const commentPool = indices.filter((idx) => idx !== authorIndex);
  if (commentPool.length === 0) {
    throw new Error(`Language "${lang}" needs at least 2 profiles for posts with comments`);
  }
  const commentIndices = [];
  for (let i = 0; i < commentCount; i++) {
    commentIndices.push(commentPool[i % commentPool.length]);
  }
  return { authorIndex, commentIndices };
}

function pickCommentAuthor(lang, postAuthorIndex, commentIndex, usedCommentAuthors) {
  const indices = langIndices[lang] ?? [];
  const pool = indices.filter((idx) => idx !== postAuthorIndex);
  if (!pool.length) {
    throw new Error(`Language "${lang}" needs at least 2 profiles when post author is ${postAuthorIndex}`);
  }
  for (let offset = 0; offset < pool.length; offset++) {
    const candidate = pool[(commentIndex + offset) % pool.length];
    if (!usedCommentAuthors.has(candidate)) return candidate;
  }
  return pool[commentIndex % pool.length];
}

export function fixPostAuthors(post, { resetPostAuthor = true } = {}) {
  const allowed = langIndices[post.language];
  if (!allowed?.includes(post.authorIndex)) {
    post.authorIndex = allowed[0];
  } else if (resetPostAuthor) {
    post.authorIndex = allowed[0];
  }

  const usedCommentAuthors = new Set();
  post.comments = (post.comments || []).map((c, i) => {
    let authorIndex = c.authorIndex;
    const validLang = allowed.includes(authorIndex);
    const self = authorIndex === post.authorIndex;
    if (!validLang || self) {
      authorIndex = pickCommentAuthor(post.language, post.authorIndex, i, usedCommentAuthors);
    }
    usedCommentAuthors.add(authorIndex);
    return { ...c, authorIndex };
  });
  return post;
}

const DEFAULT_FILES = [
  { path: 'public/data/community_seed_all_languages_questions.json', resetPostAuthor: true },
  { path: 'public/data/community_seed_all_languages_questions_batch2.json', resetPostAuthor: true },
  { path: 'public/data/community_seed_all_languages_questions_batch3.json', resetPostAuthor: true },
  { path: 'public/data/community_seed_all_languages_questions_batch4.json', resetPostAuthor: true },
  { path: 'public/data/community_seed_all_languages_questions_batch5.json', resetPostAuthor: true },
  { path: 'public/data/community_seed_all_languages_questions_batch6.json', resetPostAuthor: true },
  { path: 'public/data/community_seed_immigrant_posts.json', resetPostAuthor: false },
];

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const argFiles = process.argv.slice(2);
  const targets = argFiles.length
    ? argFiles.map((p) => ({ path: p, resetPostAuthor: !p.includes('immigrant') }))
    : DEFAULT_FILES;

  for (const { path: rel, resetPostAuthor } of targets) {
    const filePath = path.join(root, rel);
    const posts = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const post of posts) fixPostAuthors(post, { resetPostAuthor });
    fs.writeFileSync(filePath, JSON.stringify(posts, null, 2) + '\n');
    console.log('Fixed', rel, `(${posts.length} posts)`);
  }
}
