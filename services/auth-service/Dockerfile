FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
RUN apk add --no-cache openssl

FROM base AS development
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY prisma ./prisma
CMD ["node", "dist/main"]
