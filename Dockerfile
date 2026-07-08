FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma
RUN cd backend && npm ci && npx prisma generate
COPY backend/src ./backend/src

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/index.html frontend/vite.config.js frontend/eslint.config.js frontend/postcss.config.js frontend/tailwind.config.js ./frontend/
COPY frontend/public ./frontend/public
COPY frontend/src ./frontend/src
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN cd frontend && npm run build
RUN cd backend && npm prune --omit=dev

FROM node:20-bookworm-slim

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node --from=build /app/backend/package*.json ./
COPY --chown=node:node --from=build /app/backend/node_modules ./node_modules
COPY --chown=node:node --from=build /app/backend/prisma ./prisma
COPY --chown=node:node --from=build /app/backend/src ./src
COPY --chown=node:node --from=build /app/frontend/dist /app/frontend/dist

RUN mkdir -p /app/backend/.whatsapp-auth && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 3000

USER node
CMD ["node", "src/server.js"]
