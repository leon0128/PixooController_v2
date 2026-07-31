# The `development` stage is what docker-compose builds; `production` is the
# default target, so a plain `docker build` produces the deployable image.
FROM node:22-alpine AS base

# Alpine ships without a timezone database; the schedule is interpreted in local time.
RUN apk add --no-cache tzdata


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

EXPOSE 3001

CMD ["npm", "run", "start:dev"]

# ------------------------------------------------------------------ build
FROM base AS build

COPY . .
RUN npm run build

# ------------------------------------------------------------------ production
FROM node:22-alpine AS production

RUN apk add --no-cache tzdata

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Migrations run from the compiled DataSource (`npm run migration:run:prod`), so
# no TypeScript sources or ts-node are needed here.
COPY --from=build /app/dist ./dist

# Run as the image's own unprivileged user rather than root.
USER node

EXPOSE 3001

CMD ["node", "dist/main"]
