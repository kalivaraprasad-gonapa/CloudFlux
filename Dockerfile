# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies using cache
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Create public directory if it doesn't exist
RUN mkdir -p public

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner
WORKDIR /app

# Set to production environment
ENV NODE_ENV=production

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from build stage - with fallbacks for different Next.js configurations
COPY --from=builder /app/next.config.js ./next.config.js

# Create public directory
RUN mkdir -p public
# Copy public directory if it exists (using separate command to avoid failure)
COPY --from=builder /app/public ./public 2>/dev/null || true

# Standard Next.js output (non-standalone)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json

# Set proper permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set the correct host
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["npm", "start"]