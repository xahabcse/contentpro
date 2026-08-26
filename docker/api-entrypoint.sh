#!/bin/sh
# Writes wrangler's local secrets file from the container environment (so no
# secrets are baked into the image or committed), prepares the local D1
# database, then starts the Worker.
set -e

cat > /app/.dev.vars <<EOF
ENV=development
FRONTEND_URL=${FRONTEND_URL:-http://localhost:8080}
RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL:-ContentPro <onboarding@resend.dev>}
JWT_SECRET=${JWT_SECRET}
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY}
RESEND_API_KEY=${RESEND_API_KEY}
EOF

# Local D1 lives in a SQLite file under /app/.wrangler (a named volume, so it
# survives restarts). Both commands are idempotent: applied migrations are
# skipped, and seed.sql is an ON CONFLICT DO NOTHING insert. seed.sql is
# deliberately NOT a migration -- it must never reach production.
echo "[api] applying local D1 migrations ..."
npx wrangler d1 migrations apply contentpro-db --local
echo "[api] seeding local demo account ..."
npx wrangler d1 execute contentpro-db --local --file=./seed.sql

echo "[api] starting wrangler dev on 0.0.0.0:8787 ..."
exec npx wrangler dev --ip 0.0.0.0 --port 8787
