FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS production
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
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

HEALTHCHECK --interval=30s --timeout=10s CMD curl -f http://localhost:3000/api/health || exit 1

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
