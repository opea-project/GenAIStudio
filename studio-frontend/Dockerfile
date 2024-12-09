FROM node:20-alpine

# Install necessary packages
RUN apk add --no-cache gcompat python3 make g++ \
    # Needed for pdfjs-dist
    build-base cairo-dev pango-dev \
    # Install Chromium
    chromium && \
    # Install PNPM globally
    npm install -g pnpm@9.12.3

# Install git
RUN apk add --no-cache git

# Debug step to verify git installation
RUN git --version

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_OPTIONS=--max-old-space-size=8192

WORKDIR /usr/src

# Copy app source
COPY . .

# Install dependencies and build the app
RUN pnpm config set store-dir .pnpm-store && \
    pnpm install && \
    pnpm build && \
    pnpm remove esbuild && \
    rm -rf .pnpm-store && \
    pnpm prune --prod

EXPOSE 3000

CMD ["pnpm", "start"]