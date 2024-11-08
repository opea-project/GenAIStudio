ARG UBUNTU_VER=22.04
FROM ubuntu:${UBUNTU_VER} AS devel

ENV LANG=C.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends --fix-missing \
    aspell \
    aspell-en \
    build-essential \
    python3 \
    python3-pip \
    python3-dev \
    python3-distutils \
    wget \
    curl

RUN ln -sf $(which python3) /usr/bin/python

RUN python -m pip install --no-cache-dir bandit

RUN curl -L -o /usr/local/bin/hadolint https://github.com/hadolint/hadolint/releases/download/v2.8.0/hadolint-Linux-x86_64 && \
    chmod +x /usr/local/bin/hadolint

WORKDIR /