FROM node:22-slim AS base
WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build frontend
WORKDIR /app/web
RUN npm install && npm run build

WORKDIR /app

EXPOSE 3000 3001 9080

CMD ["npx", "tsx", "src/index.ts"]
