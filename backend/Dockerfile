FROM node:18-alpine AS base

FROM base AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /usr/src/app/backend

COPY package.json pnpm-lock.yaml* ./

COPY prisma ./prisma

RUN yarn global add pnpm && pnpm i --frozen-lockfile

FROM base AS builder

WORKDIR /usr/src/app/backend

COPY --from=deps /usr/src/app/backend/node_modules ./node_modules

COPY . ./

RUN yarn build

FROM base AS runner

WORKDIR /usr/src/app/backend

ENV NODE_ENV production

COPY --from=deps /usr/src/app/backend/prisma ./prisma

COPY --from=deps /usr/src/app/backend/node_modules ./node_modules

COPY --from=builder /usr/src/app/backend/dist ./dist

EXPOSE 8080

CMD ["node", "dist/Server.js"]
