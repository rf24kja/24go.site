FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ponytail: lockfile + npm ci — see dashboard Dockerfile. TS compiles here
# so the image never bakes a stale prebuilt dist/ from the deploy host.
COPY package.json package-lock.json .npmrc ./
RUN npm install -g npm@11 && npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm install -g npm@11 && npm ci --omit=dev
COPY --from=builder /app/dist/ ./dist/

EXPOSE 3100

CMD ["node", "dist/index.js"]
