FROM node:24.15-alpine AS base

ENV PNPM_CONFIG_STORE_DIR=/pnpm/store \
    COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /usr/src/app/web

RUN corepack enable

COPY package.json ./

RUN corepack install && chmod -R a+rX "$COREPACK_HOME"

COPY pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS deps

RUN pnpm install --frozen-lockfile

FROM deps AS builder

ARG API_URL

ENV API_URL=${API_URL}

COPY . ./

RUN pnpm build && rm -rf build/cache

FROM base AS prod-deps

RUN pnpm install --frozen-lockfile --prod

FROM base AS dev

RUN mkdir -p node_modules build "$PNPM_CONFIG_STORE_DIR" \
  && chown node:node node_modules build "$PNPM_CONFIG_STORE_DIR"

USER node

EXPOSE 3000

CMD ["pnpm", "dev"]

FROM node:24.15-alpine AS runner

RUN apk add --no-cache tini

ARG API_URL

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    API_URL=${API_URL}

WORKDIR /usr/src/app/web

COPY --from=builder /usr/src/app/web/package.json /usr/src/app/web/next.config.js ./

COPY --from=builder /usr/src/app/web/public ./public

COPY --from=builder /usr/src/app/web/build ./build

COPY --from=prod-deps /usr/src/app/web/node_modules ./node_modules

USER node

ENTRYPOINT ["/sbin/tini", "--"]

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
