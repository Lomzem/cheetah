FROM node:22-bookworm-slim

ARG TECTONIC_VERSION=0.15.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    poppler-utils \
  && rm -rf /var/lib/apt/lists/*

RUN tmpdir="$(mktemp -d)" \
  && curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    | tar -xz -C "$tmpdir" \
  && mv "$tmpdir/tectonic" /usr/local/bin/tectonic \
  && chmod +x /usr/local/bin/tectonic \
  && rm -rf "$tmpdir"

WORKDIR /app

COPY server.mjs ./server.mjs

ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.mjs"]
