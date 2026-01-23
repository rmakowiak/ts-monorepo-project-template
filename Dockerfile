FROM node:22-slim AS base
RUN npm i -g pnpm

# Build Stage
FROM base AS build

# Install build dependencies for native modules if needed
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm run build
RUN pnpm deploy --filter=example-service /prod/example-service

# Application Stage
FROM node:22-slim AS example-service
WORKDIR /prod/example-service
COPY --from=build --chown=1001 /prod/example-service .
USER 1001
EXPOSE 8000
CMD ["node", "dist/index.js"]
