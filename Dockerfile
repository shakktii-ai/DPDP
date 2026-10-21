# Official Playwright base image matching exact package version in package-lock.json (v1.64.1)
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app

# Ensure standard Playwright browser cache location is active
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

# Copy package manifests first for optimal Docker layer caching
COPY package*.json ./

# Install production dependencies (playwright is in "dependencies", not devDependencies)
RUN npm ci --omit=dev

# Copy application source files
COPY . .

# Ensure standard execution permissions
RUN chmod -R 755 /app

# Run the DPDP Vault persistent Playwright worker daemon
CMD ["node", "scripts/worker-daemon.mjs"]
