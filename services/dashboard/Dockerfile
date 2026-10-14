FROM node:20-alpine AS builder
WORKDIR /app
# ponytail: lockfile + npm ci — fresh `npm install` under npm 10 crashes
# with `edgesOut` null and ignores the tested tree; npm 11 everywhere.
COPY package.json package-lock.json ./
RUN npm install -g npm@11 && npm ci
COPY . .

# Inject standalone output for Docker
RUN echo 'const cfg = require("./next.config.js"); module.exports = { ...cfg, output: "standalone" };' > next.config.build.js
RUN mv next.config.js next.config.original.js && mv next.config.build.js next.config.js
RUN npx next build
RUN mv next.config.original.js next.config.js

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
