# Fallback to classic builder-friendly Dockerfile (no BuildKit-only flags)
FROM node:20-slim AS builder
WORKDIR /app

# Python is needed for prebuild script (generate:indexes); install full stdlib
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*

# Skip strict env validation during image build; runtime stage still validates
ENV VALIDATE_ENV_ON_STARTUP=0
ENV NPM_CONFIG_CACHE=/tmp/npm-cache

COPY package.json package-lock.json ./

# npm ci (no cache mounts so it works with and without BuildKit)
RUN npm ci --prefer-offline --no-audit --cache $NPM_CONFIG_CACHE

COPY . .
RUN npm run build:backend

FROM node:20-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./

# CRITICAL: Reinstall sharp for production
RUN npm prune --production && npm install --os=linux --cpu=x64 sharp

# Copy entrypoint script for cache warmup
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Use Node fetch for healthcheck to avoid extra system packages
HEALTHCHECK --interval=30s --timeout=10s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
