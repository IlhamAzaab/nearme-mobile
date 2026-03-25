# NearMe Mobile - React Native Expo Development Environment
# This Dockerfile creates a ready-to-use development environment
# Your friend can run this without installing Node.js or any dependencies
# Updated: March 2026
#
# KEY DEPENDENCIES & VERSIONS (auto-sync from package.json):
#   - react-native-svg: 15.12.1 (SVG rendering, imports: SvgXml from "react-native-svg")
#   - expo: ~54.0.33
#   - react: 19.1.0
#   - react-native: 0.81.5
#   - @supabase/supabase-js: ^2.95.3
#   - axios: ^1.13.4
# IMPORTANT: When updating dependencies, ensure this comment is updated as well

# Node 22 LTS (Active LTS until April 2027) on Alpine 3.22 for smallest image
FROM node:22-alpine

# Install necessary system packages
#   git        – clone repos / Expo may fetch templates
#   bash       – shell scripts (eas-build-post-install.sh, etc.)
#   python3    – node-gyp native compilation
#   make, g++  – build native add-ons (e.g. sharp, bcrypt)
#   curl       – healthcheck probe & network debugging
#   openssl    – TLS support for Supabase / HTTPS APIs
RUN apk add --no-cache \
    git \
    bash \
    python3 \
    make \
    g++ \
    curl \
    openssl

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package.json package-lock.json ./

# Configure npm for better network resilience inside Docker
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 60000 && \
    npm config set fetch-retry-maxtimeout 300000 && \
    npm config set fetch-timeout 600000

# Use 'npm ci' for deterministic, reproducible installs from lockfile
RUN npm ci --no-audit --no-fund

# Install @expo/ngrok globally – required for `expo start --tunnel`
# Without this, Expo prompts interactively which fails in Docker
RUN npm install -g @expo/ngrok@^4.1.0

# Clean npm cache to reduce image size
RUN npm cache clean --force

# Copy the rest of the source code
COPY . .

# Expose Expo / Metro ports
#   8081  – Metro bundler
#   8082  – Expo DevTools (SDK 54+)
#   19000 – Expo dev server (legacy)
#   19001 – Expo dev tools (legacy)
#   19002 – Expo web interface
EXPOSE 8081 8082 19000 19001 19002

# Environment variables for Expo
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
ENV REACT_NATIVE_PACKAGER_HOSTNAME=0.0.0.0
ENV NODE_ENV=development

# Healthcheck – verify Metro bundler is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8081/status || exit 1

# Default command – start Expo with tunnel for mobile access
CMD ["npx", "expo", "start", "--tunnel"]
