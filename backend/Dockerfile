FROM node:20-slim

WORKDIR /app

# Install OpenSSL required by Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

# Configure npm for flaky/slow network connections and install dependencies
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-timeout 300000 && \
    npm ci --no-audit --no-fund

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the NestJS application
RUN npm run build

EXPOSE 3001

# Run database migrations/seed, then start the server
CMD npx prisma db push --accept-data-loss && npm run db:seed && npm run start:prod
