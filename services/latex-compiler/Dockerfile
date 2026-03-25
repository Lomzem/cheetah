FROM rust:1.86-bookworm AS tectonic-builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    ca-certificates \
    perl \
    g++ \
    make \
  && rm -rf /var/lib/apt/lists/*

RUN cargo install --locked tectonic

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fontconfig \
    poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=tectonic-builder /usr/local/cargo/bin/tectonic /usr/local/bin/tectonic
COPY services/latex-compiler/server.mjs ./server.mjs

ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.mjs"]
