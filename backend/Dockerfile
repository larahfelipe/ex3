FROM node:18-alpine AS base

FROM base AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /usr/src/app/backend

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

COPY prisma ./prisma

RUN \
  if [ -f package-lock.json ]; then npm install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

FROM base AS builder

WORKDIR /usr/src/app/backend

COPY --from=deps /usr/src/app/backend/node_modules ./node_modules

COPY . .

RUN npm run build

FROM base AS runner

WORKDIR /usr/src/app/backend

ENV NODE_ENV production

COPY --from=deps /usr/src/app/backend/prisma ./prisma

COPY --from=deps /usr/src/app/backend/node_modules ./node_modules

COPY --from=builder /usr/src/app/backend/dist ./dist

EXPOSE 8080

CMD ["node", "dist/Server.js"]
