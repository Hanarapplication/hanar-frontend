# Community seed data structures (for generating accurate posts & comments)

Use this so **author names and spoken languages match**: e.g. only Chinese-name profiles author Chinese-language posts, Arabic names for Arabic, etc.

---

## 1. Profile list (index → language)

**authorIndex** in posts and comments is the **0-based index** into this profiles array (0 = first profile, 99 = 100th).

When generating content:
- **Post in language X** → use an **authorIndex** whose profile’s language is X.
- **Comment in language Y** → use an **authorIndex** whose profile’s language is Y.

| Index | Username  | Display Name        | Language |
|-------|-----------|---------------------|----------|
| 0     | seed_001  | Sarah Mitchell      | en       |
| 1     | seed_002  | Дмитрий Волков      | ru       |
| 2     | seed_003  | أحمد علي            | ar       |
| 3     | seed_004  | 김서연              | ko       |
| 4     | seed_005  | 陈明                | zh       |
| 5     | seed_006  | 田中花子            | ja       |
| 6     | seed_007  | Mehmet Yılmaz       | tr       |
| 7     | seed_008  | زهرا احمدی          | fa       |
| 8     | seed_009  | Emma Richardson     | en       |
| 9     | seed_010  | Анна Соколова       | ru       |
| 10    | seed_011  | محمد حسن            | ar       |
| 11    | seed_012  | 이준혁              | ko       |
| 12    | seed_013  | 王芳                | zh       |
| 13    | seed_014  | 佐藤健一            | ja       |
| 14    | seed_015  | Ayşe Demir           | tr       |
| 15    | seed_016  | رضا محمدی           | fa       |
| 16    | seed_017  | James Cooper        | en       |
| 17    | seed_018  | Игорь Козлов        | ru       |
| 18    | seed_019  | فاطمة إبراهيم       | ar       |
| 19    | seed_020  | 박지훈              | ko       |
| 20    | seed_021  | 李强                | zh       |
| 21    | seed_022  | 鈴木美咲            | ja       |
| 22    | seed_023  | Mustafa Öztürk      | tr       |
| 23    | seed_024  | مریم رضایی          | fa       |
| 24    | seed_025  | Olivia Bennett      | en       |
| 25    | seed_026  | Николай Морозов     | ru       |
| 26    | seed_027  | خالد محمود          | ar       |
| 27    | seed_028  | 최유진              | ko       |
| 28    | seed_029  | 张伟                | zh       |
| 29    | seed_030  | 高橋翔太            | ja       |
| 30    | seed_031  | Zeynep Kaya         | tr       |
| 31    | seed_032  | علی حسینی           | fa       |
| 32    | seed_033  | Liam Foster         | en       |
| 33    | seed_034  | Елена Новикова      | ru       |
| 34    | seed_035  | عمر عبدالله         | ar       |
| 35    | seed_036  | 한소희              | ko       |
| 36    | seed_037  | 刘洋                | zh       |
| 37    | seed_038  | 渡辺直樹            | ja       |
| 38    | seed_039  | Elif Arslan         | tr       |
| 39    | seed_040  | سارا کریمی          | fa       |
| 40    | seed_041  | Noah Phillips       | en       |
| 41    | seed_042  | Сергей Лебедев      | ru       |
| 42    | seed_043  | نورا سعيد           | ar       |
| 43    | seed_044  | 윤도현              | ko       |
| 44    | seed_045  | 赵敏                | zh       |
| 45    | seed_046  | 伊藤さくら          | ja       |
| 46    | seed_047  | Burak Şahin         | tr       |
| 47    | seed_048  | حسین موسوی          | fa       |
| 48    | seed_049  | Sophia Turner       | en       |
| 49    | seed_050  | Алексей Попов       | ru       |
| 50    | seed_051  | ياسمين فاروق        | ar       |
| 51    | seed_052  | 정민재              | ko       |
| 52    | seed_053  | 孙丽                | zh       |
| 53    | seed_054  | 山本大輔            | ja       |
| 54    | seed_055  | Deniz Aydın         | tr       |
| 55    | seed_056  | نرگس جعفری          | fa       |
| 56    | seed_057  | Isabella Wright     | en       |
| 57    | seed_058  | Павел Смирнов       | ru       |
| 58    | seed_059  | لينا وليد           | ar       |
| 59    | seed_060  | 강민지              | ko       |
| 60    | seed_061  | 周杰                | zh       |
| 61    | seed_062  | 松本ゆい            | ja       |
| 62    | seed_063  | Emre Çelik          | tr       |
| 63    | seed_064  | پریسا نوری          | fa       |
| 64    | seed_065  | Mia Martinez        | en       |
| 65    | seed_066  | Михаил Кузнецов     | ru       |
| 66    | seed_067  | رنا كمال            | ar       |
| 67    | seed_068  | 송하늘              | ko       |
| 68    | seed_069  | 吴静                | zh       |
| 69    | seed_070  | 井上翔              | ja       |
| 70    | seed_071  | Can Polat           | tr       |
| 71    | seed_072  | الهام صادقی         | fa       |
| 72    | seed_073  | Charlotte Clark     | en       |
| 73    | seed_074  | Андрей Орлов        | ru       |
| 74    | seed_075  | هالة ناصر           | ar       |
| 75    | seed_076  | 임수빈              | ko       |
| 76    | seed_077  | 黄磊                | zh       |
| 77    | seed_078  | 中村あおい          | ja       |
| 78    | seed_079  | Kerem Yıldız        | tr       |
| 79    | seed_080  | سمیرا باقری         | fa       |
| 80    | seed_081  | Amelia Lewis        | en       |
| 81    | seed_082  | Денис Федоров       | ru       |
| 82    | seed_083  | مريم عبدالرحمن      | ar       |
| 83    | seed_084  | 조현우              | ko       |
| 84    | seed_085  | 林涛                | zh       |
| 85    | seed_086  | 小林りん            | ja       |
| 86    | seed_087  | Ece Koç             | tr       |
| 87    | seed_088  | فریبا مرادی         | fa       |
| 88    | seed_089  | Harper Walker       | en       |
| 89    | seed_090  | Виктор Соловьев     | ru       |
| 90    | seed_091  | دانا شريف           | ar       |
| 91    | seed_092  | 백승민              | ko       |
| 92    | seed_093  | 何琳                | zh       |
| 93    | seed_094  | 加藤蓮              | ja       |
| 94    | seed_095  | Selin Özdemir       | tr       |
| 95    | seed_096  | شیدا قاسمی          | fa       |
| 96    | seed_097  | Evelyn Hall         | en       |
| 97    | seed_098  | Ольга Егорова       | ru       |
| 98    | seed_099  | لارا عماد           | ar       |
| 99    | seed_100  | 김도윤              | ko       |

**Language codes:** `en` (English), `ar` (Arabic), `ru` (Russian), `ko` (Korean), `zh` (Chinese), `ja` (Japanese), `tr` (Turkish), `fa` (Persian).

---

## 2. File: `community_seed.json`

Root object:

```json
{
  "profiles": [ { "username": string, "displayName": string } ],
  "posts": [ ... optional base posts, same shape as below ... ]
}
```

- **profiles**: Exactly 100 items. Order matters: index 0 = first item, index 99 = last. `username` must be `seed_001` … `seed_100`. `displayName` is the shown name (any script).
- **posts**: Optional array of local-community posts (same shape as in section 3). Can be empty `[]`.

---

## 3. File: `community_seed_immigrant_posts.json` (or posts inside `community_seed.json`)

A **JSON array** of post objects. Each post:

```json
{
  "title": "string",
  "body": "string",
  "authorIndex": 0,
  "language": "en",
  "tags": ["string", "string"],
  "comments": [
    { "body": "string", "authorIndex": 0 }
  ],
  "likeCount": 12
}
```

| Field        | Type     | Notes |
|-------------|----------|--------|
| title       | string   | Post title. |
| body        | string   | Post body. |
| authorIndex | number   | **0–99**. Must be the index of a profile whose **language** matches `language` of this post (see table above). |
| language    | string   | One of: `en`, `ar`, `ru`, `ko`, `zh`, `ja`, `tr`, `fa`. |
| tags        | string[] | e.g. `["immigrant", "texas", "housing"]`. |
| comments    | array    | Each item: `{ "body": string, "authorIndex": number }`. **authorIndex** 0–99 must match the language of the comment text (e.g. Arabic comment → use an `ar` profile index). |
| likeCount   | number   | Non-negative integer. |

**Rule:** For every post and every comment, **authorIndex** must point to a profile whose language matches the language of that post/comment. Example: a post with `"language": "ar"` must have `authorIndex` one of 2, 10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98. An Arabic comment must use one of those same indices.

---

## 4. Example (correct)

**Arabic post** – author and commenters use Arabic-profile indices (e.g. 2, 10, 18):

```json
{
  "title": "أين يمكنني فتح حساب بنكي بدون سجل ائتمان؟",
  "body": "أنا جديد في الولايات المتحدة...",
  "authorIndex": 2,
  "language": "ar",
  "tags": ["immigrant", "banking", "arabic"],
  "comments": [
    { "body": "بنوك مثل تشيس تسمح بفتح حساب بالجواز وبطاقة ثانية.", "authorIndex": 10 },
    { "body": "اتصل بمركز الهجرة للمساعدة.", "authorIndex": 18 }
  ],
  "likeCount": 12
}
```

**Chinese post** – author and commenters use Chinese-profile indices (e.g. 4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92):

```json
{
  "title": "新移民如何在美国建立信用记录？",
  "body": "刚来德州，没有信用分数...",
  "authorIndex": 4,
  "language": "zh",
  "tags": ["immigrant", "credit", "chinese"],
  "comments": [
    { "body": "先办一张担保信用卡，存押金。", "authorIndex": 12 },
    { "body": "大通和发现都有新移民项目。", "authorIndex": 20 }
  ],
  "likeCount": 20
}
```

---

## 5. Quick authorIndex by language

Use these indices for **authorIndex** so names and languages stay consistent:

- **en** (English): 0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96  
- **ru** (Russian): 1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81, 89, 97  
- **ar** (Arabic): 2, 10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98  
- **ko** (Korean): 3, 11, 19, 27, 35, 43, 51, 59, 67, 75, 83, 91, 99  
- **zh** (Chinese): 4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92  
- **ja** (Japanese): 5, 13, 21, 29, 37, 45, 53, 61, 69, 77, 85, 93  
- **tr** (Turkish): 6, 14, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94  
- **fa** (Persian): 7, 15, 23, 31, 39, 47, 55, 63, 71, 79, 87, 95  

Copy this file (or the sections you need) into ChatGPT so it generates posts and comments with matching names and languages.
