import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assignSeedAuthors } from './fix-seed-post-authors.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** 33 languages + 1 extra profile (Spanish). */
const NEW_LANG_PROFILES = [
  { lang: 'es', names: ['María García', 'Carlos Méndez', 'Ana Ruiz'] },
  { lang: 'fr', names: ['Sophie Dubois', 'Pierre Laurent', 'Amélie Martin'] },
  { lang: 'de', names: ['Anna Müller', 'Thomas Schmidt', 'Julia Weber'] },
  { lang: 'it', names: ['Marco Rossi', 'Giulia Bianchi', 'Luca Ferrari'] },
  { lang: 'pt', names: ['Ana Silva', 'João Santos', 'Maria Oliveira'] },
  { lang: 'pl', names: ['Anna Kowalska', 'Piotr Wiśniewski', 'Katarzyna Nowak'] },
  { lang: 'ro', names: ['Elena Popescu', 'Andrei Ionescu', 'Maria Dumitru'] },
  { lang: 'el', names: ['Μαρία Παπαδάκη', 'Νίκος Γεωργίου', 'Ελένη Αντωνίου'] },
  { lang: 'he', names: ['יעל כהן', 'דוד לוי', 'שירה מזרחי'] },
  { lang: 'hi', names: ['प्रिया शर्मा', 'अरुण पटेल', 'कविता सिंह'] },
  { lang: 'bn', names: ['আয়েশা রহমান', 'রহিম খান', 'সুমাই আখতার'] },
  { lang: 'ta', names: ['பிரியா குமார்', 'அர்ஜுன் ராஜன்', 'கவிதா மூர்த்தி'] },
  { lang: 'pa', names: ['ਪ੍ਰੀਤ ਕੌਰ', 'ਹਰਪ੍ਰੀਤ ਸਿੰਘ', 'ਗੁਰਪ੍ਰੀਤ ਕੌਰ'] },
  { lang: 'ur', names: ['فاطمہ خان', 'علی رضا', 'عائشہ ملک'] },
  { lang: 'ps', names: ['طاهره خان', 'احمد جان', 'نادیا علimi'] },
  { lang: 'ku', names: ['Avêsta Reşid', 'Baran Arslan', 'Rojîn Yilmaz'] },
  { lang: 'id', names: ['Siti Rahayu', 'Budi Santoso', 'Dewi Lestari'] },
  { lang: 'ms', names: ['Nurul Aini', 'Ahmad Hakim', 'Siti Aminah'] },
  { lang: 'vi', names: ['Nguyễn Lan', 'Trần Minh', 'Phạm Hương'] },
  { lang: 'th', names: ['สมใจ ใจดี', 'วิชัย สุขสม', 'มานี รักไทย'] },
  { lang: 'my', names: ['မောင်အောင်', 'စုချစ်', 'ခင်နှင်း'] },
  { lang: 'ne', names: ['Suita Shrestha', 'Ramesh Thapa', 'Anita Gurung'] },
  { lang: 'am', names: ['ሂወት ዮሐannes', 'ተስፋ በቀለ', 'Mihret Alemu'] },
  { lang: 'so', names: ['Amina Hassan', 'Mohamed Ali', 'Fatumo Abdi'] },
  { lang: 'sw', names: ['Grace Mwangi', 'Juma Otieno', 'Neema Kibet'] },
  { lang: 'ha', names: ['Fatima Musa', 'Ibrahim Bello', 'Aisha Garba'] },
  { lang: 'hy', names: ['Ani Hakobyan', 'Gevorg Sargsyan', 'Lusine Petrosyan'] },
  { lang: 'ka', names: ['Nino Beridze', 'Giorgi Kapanadze', 'Mariam Tsiklauri'] },
  { lang: 'kk', names: ['Aigul Nurbolat', 'Erbol Suleimenov', 'Aizhan Zhanar'] },
  { lang: 'az', names: ['Leyla Məmmədova', 'Rəşad Əliyev', 'Günel Həsənova'] },
  { lang: 'uz', names: ['Dilnoza Karimova', 'Jasur Rahimov', 'Maftuna Tosheva'] },
  { lang: 'uk', names: ['Olena Shevchenko', 'Andriy Kovalenko', 'Natalia Bondarenko'] },
  { lang: 'ug', names: ['Gulnar Ablat', 'Ermet Tohti', 'Aygul Mesk'] },
  { lang: 'es', names: ['Lucía Fernández'] },
];

const LEGACY_LANG_INDICES = {
  en: [0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96],
  ru: [1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81, 89, 97],
  ar: [2, 10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98],
  ko: [3, 11, 19, 27, 35, 43, 51, 59, 67, 75, 83, 91, 99],
  zh: [4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92],
  ja: [5, 13, 21, 29, 37, 45, 53, 61, 69, 77, 85, 93],
  tr: [6, 14, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94],
  fa: [7, 15, 23, 31, 39, 47, 55, 63, 71, 79, 87, 95],
};

const newProfiles = [];
const langIndices = { ...LEGACY_LANG_INDICES };
let idx = 100;

for (const entry of NEW_LANG_PROFILES) {
  for (const name of entry.names) {
    const num = String(idx + 1).padStart(3, '0');
    newProfiles.push({ username: `seed_${num}`, displayName: name });
    if (!langIndices[entry.lang]) langIndices[entry.lang] = [];
    langIndices[entry.lang].push(idx);
    idx++;
  }
}

if (newProfiles.length !== 100) {
  console.error('Expected 100 new profiles, got', newProfiles.length);
  process.exit(1);
}

const seedPath = path.join(root, 'public/data/community_seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
seed.profiles = [...seed.profiles.slice(0, 100), ...newProfiles];
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n');
console.log('Updated community_seed.json —', seed.profiles.length, 'profiles');

const postsPath = path.join(root, 'public/data/community_seed_all_languages_questions.json');
const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));

for (const post of posts) {
  const indices = langIndices[post.language];
  if (!indices?.length) {
    console.warn('No indices for language', post.language);
    continue;
  }
  const { authorIndex, commentIndices } = assignSeedAuthors(post.language, (post.comments || []).length);
  post.authorIndex = authorIndex;
  post.comments = (post.comments || []).map((c, i) => ({
    ...c,
    authorIndex: commentIndices[i],
  }));
}

fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2) + '\n');
console.log('Updated community_seed_all_languages_questions.json');

const refPath = path.join(root, 'public/data/seed_author_indices_by_language.json');
fs.writeFileSync(refPath, JSON.stringify(langIndices, null, 2) + '\n');
console.log('Wrote seed_author_indices_by_language.json');
