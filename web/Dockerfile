FROM node:18-alpine AS base

WORKDIR /usr/src/app/web

FROM base AS deps

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

RUN \
  if [ -f package-lock.json ]; then npm install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

FROM base AS builder

WORKDIR /usr/src/app/web

COPY --from=deps /usr/src/app/web/node_modules ./node_modules

COPY . .

RUN npm run build

FROM base AS runner

WORKDIR /usr/src/app/web

ENV NODE_ENV production

COPY --from=builder /usr/src/app/web/next.config.js ./

COPY --from=builder /usr/src/app/web/public ./public

COPY --from=builder /usr/src/app/web/build ./build

COPY --from=deps /usr/src/app/web/node_modules ./node_modules

COPY --from=deps /usr/src/app/web/package*.json ./

EXPOSE 3000

CMD ["npm", "start"]
