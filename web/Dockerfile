FROM node:24.15-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /usr/src/app/web

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

FROM base AS builder

WORKDIR /usr/src/app/web

ARG API_URL

ENV API_URL=${API_URL}

COPY --from=deps /usr/src/app/web/node_modules ./node_modules

COPY . ./

RUN pnpm build

FROM base AS runner

WORKDIR /usr/src/app/web

ENV NODE_ENV production

COPY --from=builder /usr/src/app/web/next.config.js ./

COPY --from=builder /usr/src/app/web/public ./public

COPY --from=builder /usr/src/app/web/build ./build

COPY --from=deps /usr/src/app/web/node_modules ./node_modules

COPY --from=deps /usr/src/app/web/package.json ./

EXPOSE 3000

CMD ["pnpm", "start"]
