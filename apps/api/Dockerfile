# Development image for the NestJS API.
FROM node:22-alpine

# Alpine ships without a timezone database; the schedule is interpreted in local time.
RUN apk add --no-cache tzdata

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3001

CMD ["npm", "run", "start:dev"]
