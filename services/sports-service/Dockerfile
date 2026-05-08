# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund

FROM base AS development
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
COPY . .
RUN npx prisma generate
EXPOSE 3004
CMD ["npm", "run", "dev"]

FROM base AS builder
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache openssl && addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
EXPOSE 3004
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup prisma ./prisma
USER appuser
CMD ["node", "dist/main"]
