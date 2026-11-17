FROM oven/bun:1.4.0

WORKDIR /app

# This image must be built with the repository root as its context.
COPY . .

RUN bun install --frozen-lockfile \
  && bun run generate --filter=@repo/database \
  && bun install --production --frozen-lockfile

ENV NODE_ENV=production

EXPOSE 8008

USER bun

CMD ["bun", "apps/ws/src/index.ts"]
