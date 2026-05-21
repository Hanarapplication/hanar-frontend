import fs from 'fs';
import path from 'path';

const ON_KEY = 'Turn this off to stop receiving push notifications on your device.';
const OFF_KEY = 'You will no longer receive push notifications on your device.';

const byLang = {
  en: {
    [ON_KEY]: 'Turn this off to stop receiving push notifications on your device.',
    [OFF_KEY]: 'You will no longer receive push notifications on your device.',
  },
  am: {
    [ON_KEY]: 'የግፍ ማሳወቂያዎችን ለማቆም ይህንን ያጥፉ። በመሣሪያዎ ላይ ማንቂያዎች አይደርሱዎትም።',
    [OFF_KEY]: 'ከአንስበዚ በመሣሪያዎ ላይ የግፍ ማሳወቂያዎች አይደርሱዎትም።',
  },
  ar: {
    [ON_KEY]: 'أوقف هذا الخيار لإيقاف تلقي إشعارات الدفع على جهازك.',
    [OFF_KEY]: 'لن تتلقى بعد الآن إشعارات الدفع على جهازك.',
  },
  az: {
    [ON_KEY]: 'Cihazınızda push bildirişləri almağı dayandırmaq üçün bunu söndürün.',
    [OFF_KEY]: 'Artıq cihazınızda push bildirişləri almayacaqsınız.',
  },
  bn: {
    [ON_KEY]: 'আপনার ডিভাইসে পুশ বিজ্ঞপ্তি পাওয়া বন্ধ করতে এটি বন্ধ করুন।',
    [OFF_KEY]: 'আপনি আর আপনার ডিভাইসে পুশ বিজ্ঞপ্তি পাবেন না।',
  },
  de: {
    [ON_KEY]: 'Schalten Sie dies aus, um keine Push-Benachrichtigungen mehr auf Ihrem Gerät zu erhalten.',
    [OFF_KEY]: 'Sie erhalten auf Ihrem Gerät keine Push-Benachrichtigungen mehr.',
  },
  el: {
    [ON_KEY]: 'Απενεργοποιήστε το για να σταματήσετε να λαμβάνετε push ειδοποιήσεις στη συσκευή σας.',
    [OFF_KEY]: 'Δεν θα λαμβάνετε πλέον push ειδοποιήσεις στη συσκευή σας.',
  },
  es: {
    [ON_KEY]: 'Desactívalo para dejar de recibir notificaciones push en tu dispositivo.',
    [OFF_KEY]: 'Ya no recibirás notificaciones push en tu dispositivo.',
  },
  fa: {
    [ON_KEY]: 'برای توقف دریافت اعلان‌های فوری در دستگاه خود، این گزینه را خاموش کنید.',
    [OFF_KEY]: 'دیگر اعلان‌های فوری را در دستگاه خود دریافت نخواهید کرد.',
  },
  fr: {
    [ON_KEY]: 'Désactivez cette option pour ne plus recevoir de notifications push sur votre appareil.',
    [OFF_KEY]: 'Vous ne recevrez plus de notifications push sur votre appareil.',
  },
  ha: {
    [ON_KEY]: 'Kashe wannan don dakatar da karbar sanarwar push a na\'urarka.',
    [OFF_KEY]: 'Ba za ka karɓi sanarwar push a na\'urarka ba kuma.',
  },
  he: {
    [ON_KEY]: 'כבה כדי להפסיק לקבל התראות push במכשיר שלך.',
    [OFF_KEY]: 'לא תקבל/י עוד התראות push במכשיר שלך.',
  },
  hi: {
    [ON_KEY]: 'अपने डिवाइस पर पुश सूचनाएँ प्राप्त करना बंद करने के लिए इसे बंद करें।',
    [OFF_KEY]: 'अब आपको अपने डिवाइस पर पुश सूचनाएँ नहीं मिलेंगी।',
  },
  hy: {
    [ON_KEY]: 'Անջատեք՝ ձեր սարքում push ծանուցումներ չստանալու համար.',
    [OFF_KEY]: 'Այլևս push ծանուցումներ չեք ստանա ձեր սարքում.',
  },
  id: {
    [ON_KEY]: 'Matikan ini untuk berhenti menerima notifikasi push di perangkat Anda.',
    [OFF_KEY]: 'Anda tidak akan lagi menerima notifikasi push di perangkat Anda.',
  },
  it: {
    [ON_KEY]: 'Disattivalo per smettere di ricevere notifiche push sul tuo dispositivo.',
    [OFF_KEY]: 'Non riceverai più notifiche push sul tuo dispositivo.',
  },
  ja: {
    [ON_KEY]: 'オフにすると、デバイスでプッシュ通知を受け取らなくなります。',
    [OFF_KEY]: 'デバイスでプッシュ通知は届かなくなります。',
  },
  ka: {
    [ON_KEY]: 'გამორთეთ, რათა მოწყობილობაზე push შეტყობინებები აღარ მიიღოთ.',
    [OFF_KEY]: 'აღარ მიიღებთ push შეტყობინებებს თქვენს მოწყობილობაზე.',
  },
  ko: {
    [ON_KEY]: '끄면 기기에서 푸시 알림을 더 이상 받지 않습니다.',
    [OFF_KEY]: '더 이상 기기에서 푸시 알림을 받지 않습니다.',
  },
  ku: {
    [ON_KEY]: 'Ji bo wergirtina agahdariyên push li ser amûra xwe rawestîne, vê bigire.',
    [OFF_KEY]: 'Tu ê êdî agahdariyên push li ser amûra xwe negirî.',
  },
  ms: {
    [ON_KEY]: 'Matikan ini untuk berhenti menerima pemberitahuan push pada peranti anda.',
    [OFF_KEY]: 'Anda tidak akan lagi menerima pemberitahuan push pada peranti anda.',
  },
  ne: {
    [ON_KEY]: 'आफ्नो उपकरणमा पुश सूचनाहरू प्राप्त गर्न बन्द गर्न यसलाई बन्द गर्नुहोस्।',
    [OFF_KEY]: 'अब तपाईंले आफ्नो उपकरणमा पुश सूचनाहरू प्राप्त गर्नुहुने छैन।',
  },
  pa: {
    [ON_KEY]: 'ਆਪਣੇ ਡਿਵਾਈਸ \'ਤੇ push ਸੂਚਨਾਵਾਂ ਪ੍ਰਾਪਤ ਕਰਨਾ ਬੰਦ ਕਰਨ ਲਈ ਇਸਨੂੰ ਬੰਦ ਕਰੋ।',
    [OFF_KEY]: 'ਤੁਸੀਂ ਹੁਣ ਆਪਣੇ ਡਿਵਾਈਸ \'ਤੇ push ਸੂਚਨਾਵਾਂ ਨਹੀਂ ਪ੍ਰਾਪਤ ਕਰੋਗੇ।',
  },
  pl: {
    [ON_KEY]: 'Wyłącz, aby przestać otrzymywać powiadomienia push na swoim urządzeniu.',
    [OFF_KEY]: 'Nie będziesz już otrzymywać powiadomień push na swoim urządzeniu.',
  },
  ps: {
    [ON_KEY]: 'په خپل وسیله کې د push خبرتیاوې ترلاسه کول بندولو لپاره دا وتړئ.',
    [OFF_KEY]: 'تاسو به نور په خپل وسیله کې push خبرتیاوې ونه ترلاسه کوئ.',
  },
  pt: {
    [ON_KEY]: 'Desative para parar de receber notificações push no seu dispositivo.',
    [OFF_KEY]: 'Você não receberá mais notificações push no seu dispositivo.',
  },
  ro: {
    [ON_KEY]: 'Dezactivați pentru a nu mai primi notificări push pe dispozitivul dvs.',
    [OFF_KEY]: 'Nu veți mai primi notificări push pe dispozitivul dvs.',
  },
  ru: {
    [ON_KEY]: 'Выключите, чтобы больше не получать push-уведомления на вашем устройстве.',
    [OFF_KEY]: 'Вы больше не будете получать push-уведомления на вашем устройстве.',
  },
  so: {
    [ON_KEY]: 'Dami si aad u joojiso helitaanka ogeysiisyada push ee qalabkaaga.',
    [OFF_KEY]: 'Mar dambe ma heli doontid ogeysiisyada push ee qalabkaaga.',
  },
  sw: {
    [ON_KEY]: 'Zima ili kuacha kupokea arifa za push kwenye kifaa chako.',
    [OFF_KEY]: 'Hutapokea tena arifa za push kwenye kifaa chako.',
  },
  ta: {
    [ON_KEY]: 'உங்கள் சாதனத்தில் push அறிவிப்புகளைப் பெறுவதை நிறுத்த இதை அணைக்கவும்.',
    [OFF_KEY]: 'நீங்கள் இனி உங்கள் சாதனத்தில் push அறிவிப்புகளைப் பெற மாட்டீர்கள்.',
  },
  th: {
    [ON_KEY]: 'ปิดเพื่อหยุดรับการแจ้งเตือน push บนอุปกรณ์ของคุณ',
    [OFF_KEY]: 'คุณจะไม่ได้รับการแจ้งเตือน push บนอุปกรณ์ของคุณอีกต่อไป',
  },
  tr: {
    [ON_KEY]: 'Cihazınızda push bildirimleri almayı durdurmak için bunu kapatın.',
    [OFF_KEY]: 'Artık cihazınızda push bildirimleri almayacaksınız.',
  },
  ug: {
    [ON_KEY]: 'ئۈسكۈنىڭىزدا push ئۇقتۇرۇشلىرىنى قوبۇل قىلىشنى توختىتىش ئۈچۈن بۇنى ئېتىڭ.',
    [OFF_KEY]: 'ئەمدى ئۈسكۈنىڭىزدا push ئۇقتۇرۇشلىرىنى قوبۇل قilmaysiz.',
  },
  uk: {
    [ON_KEY]: 'Вимкніть, щоб більше не отримувати push-сповіщення на вашому пристрої.',
    [OFF_KEY]: 'Ви більше не отримуватимете push-сповіщення на вашому пристрої.',
  },
  ur: {
    [ON_KEY]: 'اپنے آلے پر push اطلاعات وصول کرنا بند کرنے کے لیے اسے بند کریں۔',
    [OFF_KEY]: 'اب آپ اپنے آلے پر push اطلاعات وصول نہیں کریں گے۔',
  },
  uz: {
    [ON_KEY]: 'Qurilmangizda push bildirishnomalarini olishni to‘xtatish uchun buni o‘chiring.',
    [OFF_KEY]: 'Endi qurilmangizda push bildirishnomalarini olmaysiz.',
  },
  vi: {
    [ON_KEY]: 'Tắt để ngừng nhận thông báo push trên thiết bị của bạn.',
    [OFF_KEY]: 'Bạn sẽ không còn nhận thông báo push trên thiết bị của bạn nữa.',
  },
  zh: {
    [ON_KEY]: '关闭后将不再在您的设备上接收推送通知。',
    [OFF_KEY]: '您将不再在设备上接收推送通知。',
  },
};

function escapeTs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const filePath = path.join(process.cwd(), 'utils', 'translations.ts');
let content = fs.readFileSync(filePath, 'utf8');

for (const [lang, tr] of Object.entries(byLang)) {
  if (lang === 'en' || lang === 'am') continue;
  const marker = `"${lang}": {`;
  const idx = content.indexOf(marker);
  if (idx === -1) continue;
  const notifNeedle = `"Notifications": `;
  const sectionStart = idx;
  const nextLangMatch = content.slice(sectionStart + marker.length).match(/\n  "[a-z]{2}": \{/);
  const sectionEnd = nextLangMatch
    ? sectionStart + marker.length + nextLangMatch.index
    : content.length;
  const section = content.slice(sectionStart, sectionEnd);
  if (section.includes(ON_KEY)) continue;
  const notifIdx = section.indexOf(notifNeedle);
  if (notifIdx === -1) continue;
  const lineEnd = section.indexOf('\n', notifIdx);
  const insertAt = sectionStart + lineEnd + 1;
  const lines =
    `      "${ON_KEY}": "${escapeTs(tr[ON_KEY])}",\n` +
    `      "${OFF_KEY}": "${escapeTs(tr[OFF_KEY])}",\n`;
  content = content.slice(0, insertAt) + lines + content.slice(insertAt);
  console.log(`Patched translations.ts section: ${lang}`);
}

fs.writeFileSync(filePath, content);
