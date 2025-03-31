FROM node:20-slim as base

# Install pnpm 10.7.0 specifically
RUN npm install -g pnpm@10.7.0

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY .docker-npmrc .npmrc

# Install dependencies (use --no-frozen-lockfile if using pnpm 10+)
RUN pnpm install 

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:20-slim as production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.7.0

# Copy built files from base stage
COPY --from=base /app/package.json /app/pnpm-lock.yaml ./
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules

ENV NODE_ENV=production

CMD ["node", "dist/index.js"] 