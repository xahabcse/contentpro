# Studio Glass — Cardstock-এর নতুন নকশার mockup

_Last updated: 2026-11-19 · Static HTML · app-এর কোড নয়_

Cardstock (content.xahabcse.me)-এর ১১টা পাতা, প্রতিটা desktop, tablet আর mobile — তিন view-এ আলাদা করে সাজানো, মোট ৩৩টা পর্দা।
Build step নেই, dependency নেই। এই folder `app/`-এর বাইরে, তাই Vite build বা deploy-এ ঢোকে না।
এটা portfolio repo-র device-views plan-এর Phase ৪-এর প্রথম ধাপ (mockup)। Owner দেখে মতামত দিলে তবেই app-এ বসানো হবে।

## খোলা

Icon আর card preview JavaScript দিয়ে বসে (sprite নেই), তাই `file://`-এও খোলে। তবু local server-এ খোলাই ভালো:

```bash
python -m http.server 5520 --bind 127.0.0.1 --directory design
# http://127.0.0.1:5520/                 gallery: সব পাতা + তিন view পাশাপাশি
# http://127.0.0.1:5520/mobile/editor.html
```

- **আকাশ বাছা:** পাতার sun/moon বোতাম, বা URL-এ `?sky=day`, `?sky=night`। না দিলে ঢাকার ঘড়ি দেখে বাছে (দিন ০৭–১৮)। বাছাইটা পাতা থেকে পাতায় সঙ্গে যায়।
- **ফোনে (একই Wi-Fi):** `--bind 0.0.0.0` দিয়ে চালান, `ipconfig` থেকে PC-র IP নিন। দেখা শেষে Ctrl+C — LAN-এ খোলা server রেখে দেবেন না।

## নকশার মূল কথা

- **NewsPortal-এর পরিবার:** পেছনে স্থির আকাশ (রঙের তিনটা আলো আর হালকা dot grid — design canvas-এর ইঙ্গিত)। কাচ (`backdrop-filter`) শুধু কাঠামোয়: top bar, rail, panel, menu, sheet। Card আর form `.surface` — প্রায় অস্বচ্ছ, blur নেই।
- **দুই আকাশ:** day (উষ্ণ কাগজ আর sage) আর night (রাতের studio)। NewsPortal-এর মতো চারটা নয়, কারণ এটা কাজের tool — দুটো যথেষ্ট।
- **Amber-ই brand:** `#F2B705` দুই আকাশেই একমাত্র accent। ছোট লেখায় day-তে গাঢ় amber (`#845900`, 5.2:1)। Card-এর নিজের ১০টা palette (Ink, Paper, Navy…) `src/lib/palettes.ts` থেকে, আকাশে বদলায় না।
- **Font:** UI আর শিরোনাম Instrument Sans; শিরোনামের বাঁকা অংশ Instrument Serif italic (হলুদ highlighter দাগ সহ); label আর মাপ JetBrains Mono; card-এর ভেতর Archivo (এখনকার template-এর font)। আগের Space Grotesk বাদ।
- **Live সাইট থেকে যা রাখা:** live studio sandbox, carousel deck, "কেন" অংশ, ১০০ template আর ৮টা ভাগ, privacy pipeline, FAQ, Turnstile, Profile & Company-র সব field, editor-এর Content/Author/Theme/Image/Text, তিন রকম export।
- **যা ভালো করা:**
  - landing ১৫,২০০px থেকে ~৬,০০০px: ১০০টা template একসাথে না দেখিয়ে ১২টা + "Show 24 more"।
  - dashboard-এ সাজানো greeting, নতুন card/carousel-এর বড় tile, "Your signature" card, template থেকে শুরু, filter আর search, browser-এ কতটা জায়গা গেছে।
  - editor-এ slide strip-এ নম্বর, slide-এর পাশে সরানো/copy/মোছার বোতাম, zoom, export menu-তে প্রতিটার ব্যাখ্যা।
  - profile-এ পাশে live preview — নাম বদলালে card-এ কেমন দেখাবে।
  - 404 আর auth পাতা ব্র্যান্ডের সাথে মেলানো।

## View

| View | চওড়া | যে মাপে বানানো | ধরন |
|---|---|---|---|
| `desktop/` | ১০২৪px আর বেশি | ১৪৪০ | ভাসমান কাচের top bar; app পাতায় বাঁয়ে কাচের rail; editor তিন panel (template · canvas · inspector) |
| `tablet/` | ৭৪৪–১৩৬৬px | ৮৩৪ (খাড়া), ১১৮০ (আড়াআড়ি) | খাড়ায় menu drawer আর app bar, আড়াআড়িতে সরু icon rail; editor দুই panel, template drawer-এ |
| `mobile/` | ৩২০–৪৮০px | ৩৯০ | ছোট top bar আর পুরো পর্দার menu; public পাতায় নিচে CTA, app পাতায় নিচে ৫টা tab; editor চার ধাপে (Template · Write · Preview · Export), বাকি option ভাঁজ করা অংশে |

Editor-এর tablet আর mobile রূপ plan-এ owner-এর ১৪ নভেম্বরের সিদ্ধান্ত মেনে: tablet-এ ২-panel আর template drawer-এ; phone-এ সহজ mobile editor — template, field ধরে লেখা, preview, export; palette/author/background ভাঁজ করা; slide যোগ, মোছা আর ক্রম বদলানো ফোনেও।

## Shared আর view-এর নিজের

- `_shared/tokens.css` — শুধু token, দুই আকাশ আর card-এর palette।
- `_shared/base.css` — reset, আকাশ, কাচ আর surface, বোতাম, chip, form field, badge, card preview (`.cp`, সব মাপ container unit-এ, তাই ৫৬px thumbnail থেকে ৬৪০px canvas একই markup), template আর saved-design tile।
- `_shared/ui.js` — আকাশ বাছা, icon, card preview আঁকা (১৭ রকম), template আর saved design-এর তালিকা, drawer/tab/বাছাইয়ের ছোট আচরণ।
- প্রতিটা view-এর নিজের CSS (`desktop.css`, `tablet.css`, `mobile.css`)। কেউ অন্যটার CSS load করে না। Tablet আর mobile-এর CSS desktop-এর component অংশের কপি দিয়ে শুরু, তারপর নিজের layout অংশ — তাই একটা বদলালে অন্যটা ভাঙে না।

## যাচাই (১৯ নভেম্বর ২০২৬)

Chromium-এ local server-এ, script দিয়ে ১১টা পাতা মোট ১৬টা মাপে, ১৭৬ বার খুলে মাপা:

| View | মাপ |
|---|---|
| desktop | ১০২৪, ১২৮০, ১৪৪০, ১৯২০ |
| tablet | ৭৪৪, ৭৬৮, ৮৩৪, ১০২৪, ১১৮০, ১৩৬৬ |
| mobile | ৩২০, ৩৬০, ৩৭৫, ৩৯০, ৪১২, ৪৩০ |

- **পাশে বেরিয়ে যাওয়া (horizontal scroll):** কোনো পাতায়, কোনো মাপে নেই।
- **Icon আর card:** সব icon বসেছে, কোনো card preview ফাঁকা নেই।
- **Console:** কোনো error নেই।
- **আঙুলে চাপার জায়গা:** tablet আর mobile-এ বোতাম ৪৪px (ছোট বোতাম ৩৬px)।
- চোখে দেখা: desktop ১৪৪০ (day, night), tablet ৮৩৪ (day, night), mobile ৩৯০ (day, night)।

**যা যাচাই হয়নি:** আসল iPhone/iPad-এর Safari (কাচের blur Safari-তে একটু আলাদা দেখাতে পারে), কম দামি phone-এ scroll, screen reader, contrast-এর পুরো axe পরীক্ষা।

## Content

- নাম আর email সব জায়গায় Md. Sahabuddin Hossain / sujoncep@gmail.com; password field-এ শুধু `x` দিয়ে ভরা, আসল password নেই।
- Template-এর নাম, ভাগ আর palette live সাইট থেকে (১৯ নভেম্বর)। Card-এর ভেতরের লেখা উদাহরণ।
- Saved design-এর তালিকা, "2.4 MB of about 50 MB", "Resend in 0:42", "expires at 10:42" — উদাহরণ, app-এ আসল মান বসবে।
- "Show 24 more", zoom, "Keep me signed in", slide copy, strength meter, Preview বোতাম — নতুন প্রস্তাব, এখনকার app-এ নেই।
