# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

# Use node 20.11.1 as the base image
FROM node:20.11.1 as vite-app

# Accept proxy build arguments
ARG http_proxy
ARG https_proxy
ARG no_proxy

# Set proxy environment variables for package managers
ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV no_proxy=${no_proxy}
 
COPY ./react /usr/app/react
WORKDIR /usr/app/react


RUN ["npm", "install"]
RUN ["npm", "run", "build"]


FROM nginx:alpine

COPY --from=vite-app /usr/app/react/dist /usr/share/nginx/html
COPY ./react/env.sh /docker-entrypoint.d/env.sh

COPY ./react/nginx.conf /etc/nginx/conf.d/default.conf
RUN chmod +x /docker-entrypoint.d/env.sh
