# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm --filter api prisma:generate && pnpm --filter api build && pnpm --filter web build

FROM node:24-alpine AS api

RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY --from=build --chown=node:node /app /app

ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

FROM nginx:1.28-alpine AS web

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
