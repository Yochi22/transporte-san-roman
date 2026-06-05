FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend/prisma ./backend/prisma
RUN cd backend && npx prisma generate

COPY backend/src ./backend/src

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/index.html frontend/vite.config.js frontend/eslint.config.js frontend/postcss.config.js frontend/tailwind.config.js ./frontend/
COPY frontend/public ./frontend/public
COPY frontend/src ./frontend/src
RUN cd frontend && npm run build

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "src/server.js"]
