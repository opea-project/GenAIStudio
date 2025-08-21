FROM node:23-alpine

# Accept proxy build arguments
ARG http_proxy
ARG https_proxy
ARG no_proxy

# Set proxy environment variables for package managers
ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV no_proxy=${no_proxy}

# Install necessary packages
RUN apk update && apk upgrade && \
    apk add --no-cache gcompat python3 make g++ git \
    # Needed for pdfjs-dist
    build-base cairo-dev pango-dev \
    # Install Chromium
    chromium && \
    # Update npm to the latest version
    npm install -g npm@latest && \
    # Install PNPM globally
    npm install -g pnpm@latest 

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
    pnpm update cross-spawn@7.0.5 && \
    pnpm build && \
    pnpm remove esbuild && \
    rm -rf .pnpm-store && \
    rm -rf /root/.local/share/pnpm && \
    pnpm prune --prod

EXPOSE 3000

CMD ["pnpm", "start"]