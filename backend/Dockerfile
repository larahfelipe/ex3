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

ARG HOST_UID=1000
ARG HOST_GID=1000

# The code is mounted with the host's ownership, so `node` takes the host user's
# ids to write into it. A gid the image already uses keeps that group's name.
RUN deluser --remove-home node \
  && { getent group "$HOST_GID" >/dev/null || addgroup -g "$HOST_GID" node; } \
  && adduser -D -u "$HOST_UID" -G "$(getent group "$HOST_GID" | cut -d: -f1)" node \
  && mkdir -p node_modules "$PNPM_CONFIG_STORE_DIR" \
  && chown "$HOST_UID:$HOST_GID" node_modules "$PNPM_CONFIG_STORE_DIR"

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
