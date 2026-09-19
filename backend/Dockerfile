FROM node:24.15-alpine AS base

ENV PNPM_CONFIG_STORE_DIR=/pnpm/store \
    COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /usr/src/app/backend

RUN apk add --no-cache libc6-compat && corepack enable

COPY package.json ./

RUN corepack install && chmod -R a+rX "$COREPACK_HOME"

COPY pnpm-lock.yaml pnpm-workspace.yaml ./

COPY prisma ./prisma

FROM base AS deps

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY . ./

RUN pnpm build

FROM base AS prod-deps

RUN pnpm install --frozen-lockfile --prod

FROM base AS dev

RUN mkdir -p node_modules "$PNPM_CONFIG_STORE_DIR" \
  && chown node:node node_modules "$PNPM_CONFIG_STORE_DIR"

USER node

EXPOSE 8080

CMD ["pnpm", "dev"]

FROM node:24.15-alpine AS runner

RUN apk add --no-cache tini

ENV NODE_ENV=production

WORKDIR /usr/src/app/backend

COPY --from=prod-deps /usr/src/app/backend/prisma ./prisma

COPY --from=prod-deps /usr/src/app/backend/node_modules ./node_modules

COPY --from=builder /usr/src/app/backend/dist ./dist

USER node

ENTRYPOINT ["/sbin/tini", "--"]

EXPOSE 8080

CMD ["node", "dist/Server.js"]
