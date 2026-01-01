FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install wget for health check
RUN apk add --no-cache wget

COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./

EXPOSE 3000

# Health check using the lightweight /api/healthz endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/healthz || exit 1

CMD ["node", "server.js"]
