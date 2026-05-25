# Hanar community seed — AI generation brief

Copy this file (or the prompt at the bottom) into ChatGPT / Claude / etc. to generate posts, comments, and like counts for Hanar community seed JSON.

Related files in this folder:
- `community_seed.json` — 200 profiles (`seed_001`–`seed_200`)
- `seed_author_indices_by_language.json` — language → valid `authorIndex` list
- `SEED_STRUCTURE_FOR_GENERATION.md` — profile table for indices 0–99
- `community_seed_all_languages_questions_batch6.json` — best recent example (41 languages)

---

## Output format

Return a **JSON array** of post objects (top-level array, not wrapped in `{ "posts": ... }`).

```json
[
  {
    "title": "string — question title",
    "body": "string — question details",
    "authorIndex": 8,
    "language": "en",
    "tags": ["jobs", "texas", "immigrant", "question", "en"],
    "comments": [
      { "body": "string — reply in same language as post", "authorIndex": 0 },
      { "body": "...", "authorIndex": 16 },
      { "body": "...", "authorIndex": 24 },
      { "body": "...", "authorIndex": 32 }
    ],
    "likeCount": 21
  }
]
```

| Field | Type | Rules |
|-------|------|--------|
| `title` | string | Short question headline |
| `body` | string | 1–3 sentences of context |
| `authorIndex` | number | **0–199**. Must belong to a profile for this post’s `language` |
| `language` | string | One of the **41 codes** below |
| `tags` | string[] | Topic tags + `"question"` + language code |
| `comments` | array | 3–4 items typical. Each: `body` + `authorIndex` |
| `likeCount` | number | Integer ≥ 0. Server creates that many post likes (not individual like rows) |

**Do not** include individual like records in JSON. Set `likeCount` only. The seed API also adds ~3 likes per comment automatically.

---

## Critical rules (API rejects bad data)

1. **Language match** — Post `authorIndex` must be valid for that post’s `language`. Same for every comment.
2. **No self-comments** — Comment `authorIndex` must **never** equal the post’s `authorIndex`.
3. **Comment language** — Comment text must be in the **same language** as the post.
4. **Name match** — Each `authorIndex` maps to a display name in that language’s script (Arabic name for `ar`, etc.).
5. **Indices 0–199 only** — `authorIndex` = 0-based index into the 200-profile list (`seed_001` = 0, `seed_200` = 199).

---

## All 41 `language` codes

`en`, `ru`, `ar`, `ko`, `zh`, `ja`, `tr`, `fa`, `es`, `fr`, `de`, `it`, `pt`, `pl`, `ro`, `el`, `he`, `hi`, `bn`, `ta`, `pa`, `ur`, `ps`, `ku`, `id`, `ms`, `vi`, `th`, `my`, `ne`, `am`, `so`, `sw`, `ha`, `hy`, `ka`, `kk`, `az`, `uz`, `uk`, `ug`

For a full multilingual batch: **one post per language** (41 posts), same topic, fully translated.

---

## `authorIndex` by language

### Original 8 languages (13 profiles each, indices 0–99)

| Lang | Valid `authorIndex` values |
|------|------------------------------|
| en | 0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96 |
| ru | 1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81, 89, 97 |
| ar | 2, 10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98 |
| ko | 3, 11, 19, 27, 35, 43, 51, 59, 67, 75, 83, 91, 99 |
| zh | 4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92 |
| ja | 5, 13, 21, 29, 37, 45, 53, 61, 69, 77, 85, 93 |
| tr | 6, 14, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94 |
| fa | 7, 15, 23, 31, 39, 47, 55, 63, 71, 79, 87, 95 |

### Other 33 languages (indices 100–199)

| Lang | `authorIndex` values |
|------|---------------------|
| es | 100, 101, 102, 199 |
| fr | 103, 104, 105 |
| de | 106, 107, 108 |
| it | 109, 110, 111 |
| pt | 112, 113, 114 |
| pl | 115, 116, 117 |
| ro | 118, 119, 120 |
| el | 121, 122, 123 |
| he | 124, 125, 126 |
| hi | 127, 128, 129 |
| bn | 130, 131, 132 |
| ta | 133, 134, 135 |
| pa | 136, 137, 138 |
| ur | 139, 140, 141 |
| ps | 142, 143, 144 |
| ku | 145, 146, 147 |
| id | 148, 149, 150 |
| ms | 151, 152, 153 |
| vi | 154, 155, 156 |
| th | 157, 158, 159 |
| my | 160, 161, 162 |
| ne | 163, 164, 165 |
| am | 166, 167, 168 |
| so | 169, 170, 171 |
| sw | 172, 173, 174 |
| ha | 175, 176, 177 |
| hy | 178, 179, 180 |
| ka | 181, 182, 183 |
| kk | 184, 185, 186 |
| az | 187, 188, 189 |
| uz | 190, 191, 192 |
| uk | 193, 194, 195 |
| ug | 196, 197, 198 |

Source of truth: `seed_author_indices_by_language.json`

---

## How to pick authors (recommended)

**Post author:** use the **2nd profile** for that language (`allowed_indices[1]`):

- English → `authorIndex: 8` (Emma Richardson)
- Arabic → `10`
- French → `104`

**Comments:** use **other** profiles for the same language, never the post author.

English example (post author `8`):

| Comment | authorIndex | Display name |
|---------|-------------|--------------|
| 1 | 0 | Sarah Mitchell |
| 2 | 16 | James Cooper |
| 3 | 24 | Olivia Bennett |
| 4 | 32 | Liam Foster |

Languages with **only 3 profiles** (e.g. French: 103, 104, 105):

- Post author: `104`
- Comments: `103`, `105`, `103` (reuse OK; never `104` on a comment)

**Avoid:** `(commentIndex + 1) % profileCount` — on 3-profile languages the 3rd comment wraps to the post author.

---

## Tags convention

```json
"tags": ["topic1", "topic2", "topic3", "question", "en"]
```

- First tags: topic keywords (`jobs`, `housing`, `texas`, `immigrant`, etc.)
- Always include `"question"`
- Always include the post’s language code as the last tag

---

## `likeCount`

- Integer, typically **15–35**
- Server randomly assigns that many post likes from seed users
- Comment likes are generated by the server (not in JSON)

---

## Reference examples (English)

**Texas welcoming cities (batch 5):**

```json
{
  "title": "Which Texas city felt most welcoming after immigrating?",
  "body": "Thinking about moving but want somewhere with community and opportunities.",
  "authorIndex": 8,
  "language": "en",
  "tags": ["community", "texas", "moving", "question", "en"],
  "comments": [
    { "body": "Dallas–Fort Worth had many cultural groups and easier networking.", "authorIndex": 0 },
    { "body": "Houston felt the most international to me.", "authorIndex": 16 },
    { "body": "Look at commute times before deciding — Texas is huge.", "authorIndex": 24 },
    { "body": "Choose based on jobs first, community second.", "authorIndex": 32 }
  ],
  "likeCount": 18
}
```

**First job in Texas (batch 6):**

```json
{
  "title": "How did you find your first job in Texas as an immigrant?",
  "body": "I have experience from back home but not much local experience. What worked for you?",
  "authorIndex": 8,
  "language": "en",
  "tags": ["jobs", "texas", "immigrant", "question", "en"],
  "comments": [
    { "body": "My first opportunity came through someone from my community.", "authorIndex": 0 },
    { "body": "Local experience matters — even part-time helped open doors.", "authorIndex": 16 },
    { "body": "Update your resume to U.S. style and apply consistently.", "authorIndex": 24 },
    { "body": "Community groups and small business owners were more willing to give me a chance.", "authorIndex": 32 }
  ],
  "likeCount": 21
}
```

For other languages: same structure, translate title/body/comments, set `language` and tags, use that language’s `authorIndex` map.

---

## Existing seed JSON files

| File | Purpose |
|------|---------|
| `community_seed.json` | 200 profiles + optional base posts |
| `community_seed_immigrant_posts.json` | 64 mixed-topic posts |
| `community_seed_all_languages_questions.json` | Batch 1 — 41 questions |
| `community_seed_all_languages_questions_batch2.json` | Batch 2 |
| `community_seed_all_languages_questions_batch3.json` | Batch 3 |
| `community_seed_all_languages_questions_batch4.json` | Batch 4 |
| `community_seed_all_languages_questions_batch5.json` | Texas welcoming cities |
| `community_seed_all_languages_questions_batch6.json` | First job in Texas |

---

## Validation checklist

Before pasting into Admin → Seed Community:

- [ ] Valid JSON array
- [ ] Every `language` is one of the 41 codes
- [ ] Every `authorIndex` is in that language’s allowed list
- [ ] No comment shares the post’s `authorIndex`
- [ ] Comment text matches post language
- [ ] `likeCount` is a non-negative integer
- [ ] Tags include `"question"` + language code

**Local commands (from repo root):**

```bash
node scripts/validate-seed-posts.mjs public/data/your-batch.json
node scripts/fix-seed-post-authors.mjs public/data/your-batch.json
```

---

## Copy-paste prompt for another AI

```
Generate a JSON array of community question posts for the Hanar app seed system.

Rules:
- 41 posts, one per language: en, ru, ar, ko, zh, ja, tr, fa, es, fr, de, it, pt, pl, ro, el, he, hi, bn, ta, pa, ur, ps, ku, id, ms, vi, th, my, ne, am, so, sw, ha, hy, ka, kk, az, uz, uk, ug
- Same topic: [YOUR TOPIC HERE]
- Each post: title, body, authorIndex (2nd profile for that language), language, tags [topics, "question", lang], 4 comments (different authorIndex, same language, never self-comment), likeCount 15–30
- authorIndex must only use values from seed_author_indices_by_language.json
- Output ONLY valid JSON (no markdown fences)

English author pattern:
- Post authorIndex: 8
- Comment authorIndex: 0, 16, 24, 32

Attach or read: public/data/seed_author_indices_by_language.json and public/data/community_seed_all_languages_questions_batch6.json as examples.
```
