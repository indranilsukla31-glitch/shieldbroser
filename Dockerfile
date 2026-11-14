# Artei — one container serving the API and the built PWA.
# Full image for building: it has python3/make/g++, which better-sqlite3 needs when it
# has to compile from source. Same Debian release as the slim runtime image below.
FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DATABASE_PATH=/data/artei.db
COPY --from=build /app /app
RUN mkdir -p /data
EXPOSE 8787
CMD ["node", "--import", "tsx", "apps/server/src/index.ts"]
