# syntax=docker/dockerfile:1

# ---- 1. Build the React client -------------------------------------------
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- 2. Install production-only server dependencies -----------------------
FROM node:22-alpine AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ---- 3. Runtime image: API + static client, non-root ----------------------
FROM node:22-alpine
ENV NODE_ENV=production PORT=5000
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/
COPY server/src ./server/src
COPY server/scripts ./server/scripts
COPY --from=client /app/client/dist ./client/dist
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
CMD ["node", "server/src/server.js"]
