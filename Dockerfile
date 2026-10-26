# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Prisma requires the system OpenSSL libraries in Alpine at generation and
# runtime. Installing them in the shared base avoids fallback engine guesses.
RUN apk add --no-cache openssl


FROM base AS deps

COPY package.json package-lock.json* ./

RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund


FROM deps AS ci

ENV NODE_ENV=test
ENV CHROME_EXECUTABLE=/usr/bin/chromium

RUN apk add --no-cache chromium ffmpeg nss freetype harfbuzz ca-certificates ttf-freefont

COPY . .

RUN npx prisma generate

CMD ["npm", "test", "--", "--maxWorkers=1", "--no-file-parallelism"]


FROM base AS builder

ENV NODE_ENV=production
# Production security configuration is validated while Next compiles the
# instrumentation hook. These build defaults also keep public CTA URLs pointed
# at the real production application if a deployment does not inject build-time
# public environment variables. Runtime secrets and configuration are still
# injected by Compose in the runner stage.
ENV AUTH_SECRET=build-only-placeholder-not-valid-for-runtime-use
ENV APP_ORIGIN=https://app.satrcrm.com
ENV APP_URL=https://app.satrcrm.com
ENV NEXT_PUBLIC_APP_URL=https://app.satrcrm.com
ENV TRUST_PROXY=single-hop

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build


FROM base AS migrator

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY prisma ./prisma

CMD ["npx", "prisma", "migrate", "deploy"]


FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Never allow a developer or build-time environment file into the runtime
# image. Runtime configuration is injected by Compose/server environment.
RUN find /app -type f \( -name '.env' -o -name '.env.*' \) -delete \
    && mkdir -p /app/uploads \
    && chown nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
