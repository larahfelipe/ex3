FROM node:18-alpine AS base

WORKDIR /usr/src/app/web

FROM base AS deps

COPY package.json pnpm-lock.yaml* ./

RUN yarn global add pnpm && pnpm i --frozen-lockfile

FROM base AS builder

WORKDIR /usr/src/app/web

COPY --from=deps /usr/src/app/web/node_modules ./node_modules

COPY . ./

COPY .env.production .env.production

RUN yarn build

FROM base AS runner

WORKDIR /usr/src/app/web

ENV NODE_ENV production

COPY --from=builder /usr/src/app/web/next.config.js ./

COPY --from=builder /usr/src/app/web/public ./public

COPY --from=builder /usr/src/app/web/build ./build

COPY --from=deps /usr/src/app/web/node_modules ./node_modules

COPY --from=deps /usr/src/app/web/package*.json ./

EXPOSE 3000

CMD ["yarn", "start"]
