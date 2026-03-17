FROM node:22-slim AS base
WORKDIR /app

# Install backend deps
COPY package.json package-lock.json* ./
RUN npm install

# Copy backend source
COPY src/ src/
COPY tsconfig.json drizzle.config.ts openapi.json ./
COPY src/vendors/catalog.json src/vendors/catalog.json

# Build frontend (standalone mode)
COPY web/ web/
WORKDIR /app/web
RUN npm install && npm run build

WORKDIR /app

# Copy the Next.js standalone output
RUN cp -r web/.next/standalone/web/.next web/.next-prod && \
    cp -r web/.next/static web/.next-prod/static || true

EXPOSE 3000 3001 3002 9080

# Start both: Next.js on 3000, Hono API on 3001
CMD sh -c 'API_PORT=3001 MCP_PORT=3002 npx tsx src/index.ts & \
  cd web && API_INTERNAL_URL=http://localhost:3001 node .next/standalone/web/server.js'
