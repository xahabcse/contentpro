# ContentPro frontend for local Docker use. Builds the React/Vite app, then
# serves the static bundle with Caddy AND reverse-proxies /api/* to the Worker
# container -- so the app and API share one origin (localhost:8080). Same-origin
# is required for the SameSite=Strict session cookie to work.

# ---- build the SPA ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Turnstile site key is baked in at build time (import.meta.env.VITE_*).
# Default is Cloudflare's public TEST key, which always passes.
ARG VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}

COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# ---- serve + proxy ----
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY docker/Caddyfile /etc/caddy/Caddyfile
EXPOSE 8080
