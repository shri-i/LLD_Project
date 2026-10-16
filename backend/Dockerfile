# Build context is the repository root (see docker-compose.yml) because the
# backend compiles the C++ engine in ../core into a Node addon.
FROM node:20-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake g++ make python3 nlohmann-json3-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY core /app/core
COPY backend/ ./
RUN npm run build:core && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/server.js"]
