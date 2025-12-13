# Build stage
FROM node:20-alpine AS builder

# Accept proxy build arguments
ARG http_proxy
ARG https_proxy
ARG no_proxy

# Set proxy environment variables for package managers
ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV no_proxy=${no_proxy}

# Install build dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache gcompat python3 make g++ git \
    build-base cairo-dev pango-dev && \
    npm install -g pnpm@9

ENV NODE_OPTIONS=--max-old-space-size=8192

WORKDIR /usr/src

# Copy package files first for better layer caching
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/ui/package.json ./packages/ui/

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build the app and clean up
RUN pnpm build && \
    # Prune to production dependencies only
    pnpm prune --prod && \
    rm -rf node_modules/.cache && \
    rm -rf packages/*/node_modules/.cache

# Production stage
FROM node:20-alpine

# Accept proxy build arguments
ARG http_proxy
ARG https_proxy
ARG no_proxy

ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV no_proxy=${no_proxy}

# Install only runtime dependencies with patched npm
RUN apk update && apk upgrade && \
    apk add --no-cache gcompat chromium && \
    npm install -g npm@latest pnpm@latest && \
    rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_OPTIONS=--max-old-space-size=8192

WORKDIR /usr/src

# Copy only necessary files from builder
COPY --from=builder /usr/src/package.json /usr/src/pnpm-workspace.yaml ./
COPY --from=builder /usr/src/packages ./packages
COPY --from=builder /usr/src/node_modules ./node_modules

EXPOSE 3000

CMD ["pnpm", "start"]