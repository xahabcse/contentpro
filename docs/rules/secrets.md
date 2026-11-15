# Secret আর credential — local কপি

_Last updated: 2026-11-15 · learning-এর `docs/rules/secrets-setup.md` §০-এর ধরন_

কোনো আসল secret-এর মান git-এ থাকা কোনো file-এ লেখা হয় না। আসল মান থাকে শুধু এখানে: repo root-এর gitignored `.secret/` folder, Cloudflare-এর Worker secret, আর GitHub-এর secret UI।
`.env.example` আর নেই (১৫ নভেম্বর ২০২৬ থেকে); ওর পাঁচটা key নিচের file-গুলোতে গেছে।

> Worker secret (`wrangler secret put`) বা GitHub secret বসানো বা বদলানো মানে production সাথে সাথে বদলায়।
> ব্যবহারকারীর স্পষ্ট অনুমতি ছাড়া কোনো agent এগুলো চালাবে না (`/setup-secrets`-এ মান দেন ব্যবহারকারী)।

## ০. Local কপি — `.secret/`

আসল `*.env` file-গুলো gitignored। Git-এ থাকে শুধু [`.secret/README.md`](../../.secret/README.md) আর প্রতিটা file-এর `*.env.example` — একই key, সব মান `xxxxxxxx`। নতুন device-এ প্রতিটা `.example` কপি করে `.example` ছাড়া নামে রাখো আর মান বসাও। নতুন key যোগ করলে আসল file আর `.example` দুটোতেই যোগ করো।

| File | Key | কোথায় লাগে |
|---|---|---|
| `worker.env` | `JWT_SECRET` | Worker secret `JWT_SECRET` (session)। এখনকার মান local docker-এর default |
| `turnstile.env` | `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Signup-এর bot check। এখনকার মান Cloudflare-এর public **test** key (সবসময় পাস করে)। Production-এ site key app-এর build-এ, secret Worker secret `TURNSTILE_SECRET_KEY` |
| `resend.env` | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | যাচাই আর পাসওয়ার্ড বদলের mail। Key ফাঁকা মানে mail বন্ধ — seed করা demo account দিয়ে চলে। Production-এ Worker secret `RESEND_API_KEY` |
| — | Cloudflare account (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`) | contentpro portfolio-র সাথে একই account (A)-এ চলে, তাই file একটাই: `D:/Exp-Work/protfolio/.secret/cloudflare.env` |

Production-এর আসল মান রাখতে চাইলে এই file-গুলোতেই রাখো (test মানের বদলে); local docker-এর জন্য আলাদা কিছু লাগে না, কারণ `docker-compose.yml`-এ প্রতিটা variable-এর default আছে।

প্রতিটা file সাধারণ `KEY=value` লাইন; `#` দিয়ে শুরু লাইন নোট। Command-এর ঠিক আগে load করো:

```bash
# Git Bash, এই repo-র folder থেকে
set -a; . .secret/resend.env; set +a

# Cloudflare-এর command (wrangler): portfolio-র file, পুরো path দিয়ে
set -a; . D:/Exp-Work/protfolio/.secret/cloudflare.env; set +a
```

- **মান কখনো দেখাবে না** — `cat`, `echo`, log, commit message, chat বা screenshot-এ নয়।
- **অন্য file-এ কপি করবে না** — script, `wrangler.toml` বা docs-এ বসালে সেটাই commit হয়ে যাবে।
- **Load করা মানেই অনুমতি নয়।** `wrangler secret put`, remote D1-এ লেখা, deploy, mail পাঠানো — আগের মতোই ব্যবহারকারীর স্পষ্ট অনুমতি নিয়ে।
- নতুন file বানালে `git check-ignore -v .secret/<file>` দিয়ে দেখে নাও সত্যিই ignore হচ্ছে। `.secret/` `.dockerignore`-এও আছে, তাই docker image-এ ঢোকে না।
- নতুন device-এ `.secret/` নিজে থেকে আসে না — password manager থেকে আবার বানাতে হয়।
- `api/.dev.vars.example` থাকছে: ওটা `wrangler dev`-এর local variable-এর তালিকা, secret-এর কপি নয়।
