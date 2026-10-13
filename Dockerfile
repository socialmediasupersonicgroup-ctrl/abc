# NEXUS production image (used by Railway; works on any Docker host).
# Full Debian image: ships OpenSSL, which Prisma's query engine needs, so no apt step is required.
FROM node:22-bookworm AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# A throwaway database URL so the build never touches real data.
RUN DATABASE_URL="file:/tmp/build.db" npm run build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app /app
RUN mkdir -p /data
EXPOSE 3000
CMD ["sh", "scripts/start-production.sh"]
