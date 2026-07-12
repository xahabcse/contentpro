#!/bin/sh
# Writes wrangler's local secrets file from the container environment (so no
# secrets are baked into the image or committed), then starts the Worker.
set -e

cat > /app/.dev.vars <<EOF
ENV=development
FRONTEND_URL=${FRONTEND_URL:-http://localhost:8080}
RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL:-ContentPro <onboarding@resend.dev>}
MONGODB_URI=${MONGODB_URI}
JWT_SECRET=${JWT_SECRET}
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY}
RESEND_API_KEY=${RESEND_API_KEY}
CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}
EOF

echo "[api] starting wrangler dev on 0.0.0.0:8787 ..."
exec npx wrangler dev --ip 0.0.0.0 --port 8787
