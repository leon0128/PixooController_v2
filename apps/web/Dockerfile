# The `development` stage is what docker-compose builds; `production` is the
# default target, so a plain `docker build` produces the deployable image.
FROM node:22-alpine AS base


# npm's defaults give up quickly, and on a Raspberry Pi an install can run for
# fifteen minutes — long enough that a single dropped connection fails the build.
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=600000

WORKDIR /app

COPY package.json package-lock.json ./
# A cache mount keeps the downloaded tarballs out of the image while letting a
# retry — and the production stage's second install — reuse them.
RUN --mount=type=cache,target=/root/.npm npm ci

# ----------------------------------------------------------------- development
FROM base AS development

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ------------------------------------------------------------------ build
FROM base AS build

COPY . .

# NEXT_PUBLIC_* values are inlined at build time, so the browser-facing API URL has
# to be known here rather than at run time.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ------------------------------------------------------------------ production
FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# `output: 'standalone'` bundles the server and just the dependencies it uses.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
