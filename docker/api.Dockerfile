# ContentPro API for local Docker use. Runs the real Cloudflare Worker locally
# via `wrangler dev` (workerd + Miniflare) -- same code that ships to
# production, with Durable Objects + KV simulated locally. Debian (glibc) base
# is required: workerd does not run on Alpine/musl.
FROM node:22-bookworm-slim

WORKDIR /app

# Install deps first for layer caching. Use the committed lockfile (npm ci) so
# the container resolves exactly what works locally.
COPY api/package.json api/package-lock.json ./
RUN npm ci

# App source (node_modules excluded via .dockerignore, so the install above is kept).
COPY api/ ./

COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh

# Skip interactive/telemetry prompts inside the container.
ENV CI=1
ENV WRANGLER_SEND_METRICS=false

EXPOSE 8787
ENTRYPOINT ["api-entrypoint.sh"]
