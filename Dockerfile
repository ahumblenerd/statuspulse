FROM node:22-slim AS base
WORKDIR /app

# Install backend deps
COPY package.json package-lock.json* ./
RUN npm install

# Copy backend source
COPY src/ src/
COPY tsconfig.json drizzle.config.ts openapi.json ./

# Build frontend
COPY web/ web/
WORKDIR /app/web
RUN npm install && npm run build
WORKDIR /app

# The standalone output lives at web/.next/standalone/
# Next.js needs static assets copied alongside it
RUN cp -r web/.next/static web/.next/standalone/web/.next/static
RUN cp -r web/public web/.next/standalone/web/public 2>/dev/null || true

EXPOSE 3000 3001 3002 9080

# Start Hono API (3001) + Next.js frontend (3000)
# PORT env tells Next.js standalone which port to use
ENV PORT=3000
CMD sh -c 'API_PORT=3001 MCP_PORT=3002 npx tsx src/index.ts & \
  cd web/.next/standalone/web && node server.js'
