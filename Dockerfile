FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    assimp-utils \
    blender \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build \
  && npm prune --omit=dev --no-audit --no-fund

ENV NODE_ENV=production
ENV SERVE_FRONTEND=true
ENV PORT=4000
ENV BLENDER_BIN=blender
ENV ASSIMP_BIN=assimp
ENV STORAGE_ROOT=/app/backend/storage

EXPOSE 4000

CMD ["npm", "start"]
