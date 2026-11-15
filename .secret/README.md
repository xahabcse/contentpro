# `.secret/` — local credential

এই folder-এ এই PC-র আসল credential থাকে, প্রতিটা service-এর আলাদা `*.env` file-এ। আসল file-গুলো **gitignored** — কখনো commit হয় না।
Git-এ থাকে শুধু এই README আর প্রতিটা file-এর `*.example` template, যেখানে সব মান `xxxxxxxx`। কোন device-এ কী কী মান লাগবে, সেটা এগুলো দেখে বোঝা যায়।

## নতুন device-এ

1. প্রতিটা `<name>.env.example` কপি করে `<name>.env` নামে রাখো (একই folder-এ)।
2. `xxxxxxxx`-গুলোর জায়গায় password manager থেকে আসল মান বসাও। কোন মান কোথা থেকে আসে, প্রতিটা key-এর উপরের comment-এ লেখা।
3. `git status`-এ আসল `*.env` file দেখা গেলে থামো — মানে ignore কাজ করছে না।

```bash
for f in .secret/*.env.example; do [ -f "${f%.example}" ] || cp "$f" "${f%.example}"; done
```

| File | Key | এই PC-তে |
|---|---|---|
| `worker.env` | `JWT_SECRET` | আছে |
| `turnstile.env` | `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | আছে |
| `resend.env` | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | আছে |

Cloudflare account credentials: D:/Exp-Work/protfolio/.secret/cloudflare.env (account A, shared).

পুরো নিয়ম (load করার command, কী করা যাবে না): [docs/rules/secrets.md](../docs/rules/secrets.md)।
