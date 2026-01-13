FROM oven/bun:1 AS base
WORKDIR /app

# Copy package files
COPY server/package.json server/bun.lock* ./server/

# Install dependencies
WORKDIR /app/server
RUN bun install --frozen-lockfile --production

# Copy source files
WORKDIR /app
COPY server/ ./server/
COPY client/ ./client/

# Expose port
EXPOSE 3000

# Start the server
WORKDIR /app/server
CMD ["bun", "run", "start"]
