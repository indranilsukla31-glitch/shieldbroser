# Artei — one container serving the API and the built PWA.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DATABASE_PATH=/data/artei.db
COPY --from=build /app /app
RUN mkdir -p /data
EXPOSE 8787
CMD ["node", "--import", "tsx", "apps/server/src/index.ts"]
