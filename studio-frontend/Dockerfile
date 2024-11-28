FROM node:20-alpine

# Install necessary packages
RUN apk add --no-cache gcompat=1.1.0-r4 python3=3.12.7-r0 make=4.4.1-r2 g++=13.2.1_git20240309-r0 \
    # Needed for pdfjs-dist
    build-base=0.5-r3 cairo-dev=1.18.0-r0 pango-dev=1.52.2-r0 \
    # Install Chromium
    chromium && \
    # Install PNPM globally
    npm install -g pnpm@9.12.3

# Install git
RUN apk add --no-cache git=2.45.2-r0

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