import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assignSeedAuthors } from './fix-seed-post-authors.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const POSTS = [
  ['en', 'How do I meet people and build a social circle as a newcomer?', 'I work from home and feel isolated. What worked for you in your first year?', ['Check local community center event boards.', 'Language exchange meetups on Meetup.com helped me a lot.', 'Volunteering one evening a week led to real friendships.'], ['community', 'social', 'newcomer']],
  ['ru', 'Как получить SSN после переезда в США?', 'У меня есть виза и разрешение на работу. Какие документы нужны в SSA?', ['Запишитесь онлайн на ssa.gov — без записи долго ждать.', 'Возьмите паспорт, I-94 и письмо от работодателя.', 'Приходите рано утром, очередь движется быстрее.'], ['immigration', 'ssn', 'work']],
  ['ar', 'ما أفضل طريقة لإرسال الأموال للعائلة في الوطن؟', 'أبحث عن خيار آمن برسوم معقولة. ما الذي تستخدمونه؟', ['قارن Wise و Remitly و Xoom قبل كل تحويل.', 'احذر من أي شخص يطلب تحويلاً عبر شخص مجهول.', 'البنوك أغلى — التطبيقات عادة أوفر.'], ['money', 'family', 'remittance']],
  ['ko', '미국에서 자동차 보험은 처음에 어떻게 가입하나요?', '차를 샀는데 보험 견적이 너무 달라요. 뭘 기준으로 고르나요?', ['최소 liability부터 맞추고 deductible을 비교하세요.', '미국 운전 경력이 없으면 premium이 높을 수 있어요.', '여러 회사에서 같은 조건으로 quote 받아보세요.'], ['insurance', 'driving', 'cars']],
  ['zh', '在美国怎么准备路考？需要练多久？', '有中国驾照但还没换本地驾照，有点紧张。', ['先预约 written test，通过后再约 road test。', '找驾校练几次平行停车和 stop sign 很有用。', '考试当天带齐证件和保险证明。'], ['driving', 'license', 'tips']],
  ['ja', 'テキサスの夏の暑さ、新参者はどう乗り切る？', 'エアコン代も心配です。節約しつつ快適に過ごすコツは？', ['Thermostat は 78°F 前後がバランス良いです。', 'カーテンで日射を遮ると効果大。', 'こまめな水分補給を忘れずに。'], ['weather', 'texas', 'life']],
  ['tr', 'Çocuğum için okul nasıl seçilir?', 'Public mu charter mı, yeni geldik karar veremiyoruz.', ['Önce adresinize göre zoned school\'u öğrenin.', 'GreatSchools puanına bakın ama tek kriter olmasın.', 'Okulu ziyaret edip öğretmenlerle konuşun.'], ['school', 'family', 'education']],
  ['fa', 'در شهر جدید چطور کار پیدا کنم؟', 'رزومه آماده است ولی شبکه آشنایی ندارم.', ['LinkedIn را کامل کنید و هر هفته پیام بفرستید.', 'رویدادهای حرفه‌ای محلی را امتحان کنید.', 'کار داوطلبانه رزومه را قوی می‌کند.'], ['jobs', 'career', 'networking']],
  ['es', '¿Cómo elijo un plan de seguro médico si nunca lo tuve?', 'Me confunden deductible, copay y premium. ¿Por dónde empiezo?', ['Empieza comparando si tus doctores están in-network.', 'Un deductible alto baja la prima pero pagas más al usarlo.', 'Pregunta si calificas para subsidio en marketplace.'], ['health', 'insurance', 'newcomer']],
  ['fr', 'Comment fonctionne l\'impôt sur le revenu la première année ?', 'Je viens d\'arriver en cours d\'année. Dois-je déclarer même si j\'ai peu gagné ?', ['Oui, déclarez si vous avez un revenu imposable.', 'Gardez tous vos W-2 et 1099.', 'Un CPA communautaire peut aider gratuitement parfois.'], ['tax', 'finance', 'newcomer']],
  ['de', 'Wie finde ich einen zuverlässigen Handwerker für Reparaturen?', 'Ich kenne niemanden hier.', ['Nachbarn fragen ist oft am besten.', 'Nextdoor und lokale Facebook-Gruppen haben Empfehlungen.', 'Immer schriftliches Angebot vor Arbeitsbeginn verlangen.'], ['home', 'repairs', 'tips']],
  ['it', 'Come funziona l\'assicurazione auto per chi è appena arrivato?', 'Non ho storico di guida americano. I preventivi sono alti.', ['Inizia con la responsabilità civile minima legale.', 'Chiedi preventivi identici a 3 compagnie.', 'Un corso di guida difensiva può abbassare il premio.'], ['insurance', 'driving', 'cars']],
  ['pt', 'Qual a melhor forma de mandar dinheiro para a família no Brasil?', 'Quero segurança e taxa baixa. O que vocês usam?', ['Compare Wise, Remitly e bancos online.', 'Evite transferências com desconhecidos.', 'Confira o câmbio do dia antes de enviar.'], ['money', 'family', 'remittance']],
  ['pl', 'Jak zapisać dziecko do szkoły publicznej?', 'Nie wiem od czego zacząć po przeprowadzce.', ['Sprawdź stronę dystryktu szkolnego wg adresu.', 'Przygotuj akt urodzenia i dowód zamieszkania.', 'Zadzwoń do biura szkoły — często pomogą.'], ['school', 'family', 'education']],
  ['ro', 'Cum găsesc un job rapid după relocare?', 'Am permis de muncă dar rețea profesională zero.', ['Optimizează LinkedIn și aplică zilnic.', 'Networking local bate doar aplicările online.', 'Voluntariatul umple golurile din CV.'], ['jobs', 'career', 'networking']],
  ['el', 'Πώς στέλνω χρήματα στην οικογένεια στο εξωτερικό;', 'Ψάχνω ασφαλή τρόπο με χαμηλά έξοδα.', ['Σύγκρινε Wise και Remitly πριν κάθε αποστολή.', 'Μην στέλνεις μέσω άγνωστων.', 'Οι τράπεζες συνήθως χρεώνουν περισσότερο.'], ['money', 'family', 'remittance']],
  ['he', 'איך בוחרים ביטוח רכב בפעם הראשונה?', 'הצעות המחיר מאוד שונות. מה חשוב לבדוק?', ['השווה deductible ו-premium יחד.', 'בדוק אם יש הנחה על נהיגה defensive.', 'בקש הצעות מאותם תנאים מ-3 חברות.'], ['insurance', 'driving', 'cars']],
  ['hi', 'नए शहर में दोस्त कैसे बनाएं?', 'घर से काम करता हूँ, अकेलapan लगता है।', ['Community center की events देखें।', 'Meetup पर language exchange अच्छा काम करता है।', 'सप्ताह में एक बार volunteering से जुड़ाव बनता है।'], ['community', 'social', 'newcomer']],
  ['bn', 'প্রথমবারের মতো ট্যাক্স রিটার্ন কীভাবে দেব?', 'W-2 পেয়েছি কিন্তু বুঝতে পারছি না।', ['TurboTax বা H&R Block দিয়ে শুরু করতে পারেন।', 'সব W-2 ও 1099 এক জায়গায় রাখুন।', 'Community tax clinic বিনামূল্যে সাহায্য করে।'], ['tax', 'finance', 'newcomer']],
  ['ta', 'புதிய நகரத்தில் வேலை எப்படி தேடுவது?', 'LinkedIn profile ready ஆனால் contacts இல்லை.', ['தினமும் apply செய்யுங்கள்.', 'Local networking events attend பண்ணுங்கள்.', 'Volunteer work CV gap நிரப்ப helpful.'], ['jobs', 'career', 'networking']],
  ['pa', 'ਬੱਚੇ ਨੂੰ public school ਵਿੱਚ ਕਿਵੇਂ ਦਾਖਲ ਕਰੀਏ?', 'ਨਵੇਂ ਪਤੇ ਤੇ district ਸਮਝ ਨਹੀਂ ਆ ਰਹੀ।', ['School district website ਤੇ address check ਕਰੋ।', 'Birth certificate ਅਤੇ proof of address ਲਿਆਓ।', 'School office call ਕਰੋ — ਕਈ ਵਾਰ Punjabi help ਮਿਲਦੀ ਹੈ।'], ['school', 'family', 'education']],
  ['ur', 'گاڑی کا insurance پہلی دفعہ کیسے لیں?', 'Quotes بہت مختلف آ رہی ہیں۔', ['Pehle liability minimum compare karein.', 'Teen companies se same terms par quote lein.', 'Defensive driving course premium kam kar sakta hai.'], ['insurance', 'driving', 'cars']],
  ['ps', 'په نوي ښار کې ملګري څنګه پیدا کړم?', 'له کوره کار کوم او یوازېتوب احساس کوم.', ['Community center events وګورئ.', 'Meetup language exchange ډیره مرسته وکړه.', 'هفته کې یو ځل volunteer friendship رامنځته کوي.'], ['community', 'social', 'newcomer']],
  ['ku', 'Li bajarê nû çawa kar bibînim?', 'CV amade ye lê tora profesyonel tune ye.', ['LinkedIn temam bike û her hefte apply bike.', 'Bûyerên networking ên herêmî biceribîne.', 'Volunteer CV diqewime dike.'], ['jobs', 'career', 'networking']],
  ['id', 'Bagaimana cara kirim uang ke keluarga di tanah air?', 'Mau yang aman dan biaya rendah.', ['Bandingkan Wise, Remitly, dan Xoom.', 'Jangan transfer lewat orang tidak dikenal.', 'Cek kurs sebelum kirim.'], ['money', 'family', 'remittance']],
  ['ms', 'Macam mana nak pilih sekolah untuk anak?', 'Baru pindah, keliru antara public dan charter.', ['Semak sekolah zon ikut alamat rumah.', 'Lawati sekolah dan bercakap dengan guru.', 'GreatSchools rujuk saja, bukan satu-satunya faktor.'], ['school', 'family', 'education']],
  ['vi', 'Làm sao kết bạn khi mới đến Mỹ?', 'Làm việc tại nhà, cảm thấy cô đơn.', ['Xem sự kiện ở community center.', 'Meetup language exchange rất hữu ích.', 'Tình nguyện một buổi/tuần giúp có bạn bè.'], ['community', 'social', 'newcomer']],
  ['th', 'ส่งเงินกลับบ้านอย่างไรให้ปลอดภัยและถูก?', 'อยากรู้ว่าใครใช้แอปอะไรบ้าง', ['เปรียบเทียบ Wise Remitly ก่อนส่งทุกครั้ง', 'อย่าโอนผ่านคนแปลกหน้า', 'ธนาคารมักแพงกว่าแอป'], ['money', 'family', 'remittance']],
  ['my', 'အသစ်ရောက်တဲ့အခါ မိတ်ဆွေတွေ ဘယ်လိုရှာမလဲ?', 'အိမ်ကနေ အလုပ်လုပ်နေလို့ တစ်ယောက်တည်း ခံစားရတယ်။', ['community center event တွေ ကြည့်ပါ။', 'Meetup language exchange ကောင်းပါတယ်။', 'တစ်ပတ်ကို တစ်ကြိမ် volunteer လုပ်ရင် သူငယ်ချင်းရတယ်။'], ['community', 'social', 'newcomer']],
  ['ne', 'पहिलो पटक car insurance कसरी लिने?', 'Quote हरू धेरै फरक छन्।', ['पहिले liability minimum तुलना गर्नुहोस्।', '३ company बाट same terms मा quote लिनुहोस्।', 'Defensive driving course ले premium घटाउन सक्छ।'], ['insurance', 'driving', 'cars']],
  ['am', 'በአሜሪካ ገንዘብ ወደ ቤተሰብ እንዴት እላካለሁ?', 'ደህንነቱ የተጠበቀ እና ርካሽ መንገድ እፈልጋለሁ።', ['Wise እና Remitly አCompare አድርግ።', 'በ-unknown ሰው transfer አትደርጉ።', 'ባንኮች ብዙ ጊዜ ይበልጥ ናቸው።'], ['money', 'family', 'remittance']],
  ['so', 'Sidee baan u helaa caymis baabuur markii ugu horreysay?', 'Qiimaha way kala duwan yihiin.', ['Marka hore liability minimum isbarbar dhig.', 'Ka codso 3 shirkadood shuruudo isku mid ah.', 'Koorsada defensive driving waxay dhimi kartaa premium.'], ['insurance', 'driving', 'cars']],
  ['sw', 'Ninawezaje kutuma pesa kwa familia nyumbani?', 'Nataka salama na ada ndogo.', ['Linganisha Wise na Remitly kila mara.', 'Usitume kupitia watu usiowajua.', 'Benki mara nyingi ni ghali zaidi.'], ['money', 'family', 'remittance']],
  ['ha', 'Yaya zan samu abokai a sabon birni?', 'Ina aiki daga gida kuma ina jin keɓancewa.', ['Duba events a community center.', 'Meetup language exchange ya taimaka mini.', 'Volunteer sau daya a mako yana samar da abokai.'], ['community', 'social', 'newcomer']],
  ['hy', 'Աmericaում առաջին անգամ հարկային հայտարարություն ինչպե՞ս ներկայացնել', 'W-2 ունեմ, բայց շփոթված եմ:', ['Պարզ դեպքում TurboTax-ը բավարար է:', 'Պահեք բոլոր W-2 և 1099 ձևերը:', 'Community VITA clinic-ները երբեմն անվճար են օգնում:'], ['tax', 'finance', 'newcomer']],
  ['ka', 'როგორ ვიპოვო სამუშაო ახალ ქალაქში?', 'CV მზადაა მაგრამ კავშირები არ მაქვს.', ['LinkedIn განაახლე და ყოველდღე apply.', 'Networking events სცადე.', 'Volunteering CV-ს აძლიერებს.'], ['jobs', 'career', 'networking']],
  ['kk', 'Жаңа қалада достарды қалай табуға болады?', 'Үйден жұмыс істеймін, жалғыз сезінемін.', ['Community center іс-шараларын қараңыз.', 'Meetup language exchange көмектесті.', 'Аптасына бір рет volunteer достық әкеледі.'], ['community', 'social', 'newcomer']],
  ['az', 'Avtomobil sığortasını ilk dəfə necə seçmək olar?', 'Təkliflər çox fərqlidir.', ['Əvvəlcə minimum liability müqayisə edin.', '3 şirkətdən eyni şərtlərlə qiymət alın.', 'Defensive driving kursu primi azalda bilər.'], ['insurance', 'driving', 'cars']],
  ['uz', 'Oilaga pul yuborishning eng xavfsiz yo\'li qaysi?', 'Past komissiya xohlayman.', ['Har safar Wise va Remitly ni solishtiring.', 'Notanish odamlar orqali yubormang.', 'Banklar odatda qimmatroq.'], ['money', 'family', 'remittance']],
  ['uk', 'Як знайти роботу в новому місті?', 'Резюме готове, але мережі контактів немає.', ['Оновлюй LinkedIn і подавай щодня.', 'Місцеві networking events дуже допомагають.', 'Волонтерство зміцнює CV.'], ['jobs', 'career', 'networking']],
  ['ug', 'يېڭى شەھەردە دوست قانداق تاپىمەن?', 'ئۆيدىن ئishلەيمەن، يALغۇZ his قىلىمەن.', ['Community center پائالىيەتلىرini كۆرۈڭ.', 'Meetup language exchange بەك ياخshi.', 'ھەپتىگە bir قېتىم volunteer دوستلىشىشكە ياردەم قىلىدۇ.'], ['community', 'social', 'newcomer']],
];

function buildPost([lang, title, body, comments, tagBase], seed) {
  const { authorIndex, commentIndices } = assignSeedAuthors(lang, comments.length);
  const likeCount = 15 + (seed % 23);
  return {
    title,
    body,
    authorIndex,
    language: lang,
    tags: [...tagBase, 'question', lang],
    comments: comments.map((c, i) => ({
      body: c,
      authorIndex: commentIndices[i],
    })),
    likeCount,
  };
}

const out = POSTS.map((p, i) => buildPost(p, i));
const outPath = path.join(root, 'public/data/community_seed_all_languages_questions_batch2.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log('Wrote', out.length, 'posts to', outPath);
