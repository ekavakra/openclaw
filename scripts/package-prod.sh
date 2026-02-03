#!/usr/bin/env bash
# scripts/package-prod.sh
# Packages OpenClaw for production deployment

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/dist/deploy"
BUNDLE_NAME="openclaw-deploy.zip"

echo "==> Preparing package directory..."
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

echo "==> Building Gateway image..."
docker build -t openclaw:prod \
  --build-arg OPENCLAW_DOCKER_APT_PACKAGES="docker-ce-cli" \
  -f "$ROOT_DIR/Dockerfile" "$ROOT_DIR"

echo "==> Building Sandbox image..."
docker build -t openclaw-sandbox:prod -f "$ROOT_DIR/Dockerfile.sandbox" "$ROOT_DIR"

echo "==> Building Sandbox Browser image..."
docker build -t openclaw-sandbox-browser:prod -f "$ROOT_DIR/Dockerfile.sandbox-browser" "$ROOT_DIR"

echo "==> Exporting images..."
docker save openclaw:prod | gzip > "$PACKAGE_DIR/openclaw_prod.tar.gz"
docker save openclaw-sandbox:prod | gzip > "$PACKAGE_DIR/openclaw_sandbox_prod.tar.gz"
docker save openclaw-sandbox-browser:prod | gzip > "$PACKAGE_DIR/openclaw_sandbox_browser_prod.tar.gz"

echo "==> Copying deployment files..."
cp "$ROOT_DIR/docker-compose.prod.yml" "$PACKAGE_DIR/docker-compose.yml"

# Create a template .env file
cat > "$PACKAGE_DIR/.env.example" <<EOF
# OpenClaw Gateway Security
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
OPENCLAW_GATEWAY_USERNAME=admin
OPENCLAW_GATEWAY_PASSWORD=change-me-please

# AI Providers
OLLAMA_HOST=http://host.docker.internal:11434
OPENCLAW_DEFAULT_MODEL=ollama/gemini-3-flash-preview:cloud

# Sandbox Images
OPENCLAW_SANDBOX_IMAGE=openclaw-sandbox:prod
OPENCLAW_SANDBOX_BROWSER_IMAGE=openclaw-sandbox-browser:prod

# Networking
OPENCLAW_DOCKER=1
OPENCLAW_SANDBOX_DOCKER_NETWORK=openclaw-net

# Docker Socket GID (Optional, see DEPLOY.md)
# Find with: stat -c '%g' /var/run/docker.sock
# DOCKER_GID=999
EOF

echo "==> Creating DEPLOY.md..."
cat > "$PACKAGE_DIR/DEPLOY.md" <<'EOF'
# OpenClaw Production Deployment Guide

## Prerequisites
- Docker & Docker Compose installed on the server.

## Installation Steps
1. Transfer this folder to your server.
2. Load the images:
   \`\`\`bash
   docker load < openclaw_prod.tar.gz
   docker load < openclaw_sandbox_prod.tar.gz
   docker load < openclaw_sandbox_browser_prod.tar.gz
   \`\`\`
3. Setup environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env and set your password
   nano .env
   \`\`\`
4. (Optional) Setup Non-Root Docker Access:
   If you want to run the Gateway as the 'node' user but still allow it to manage sandboxes:
   a. Find the Docker GID on your host: \`stat -c '%g' /var/run/docker.sock\`
   b. Uncomment \`DOCKER_GID\` in \`.env\` and set it to that value.
   c. The \`docker-compose.yml\` is pre-configured to use this variable if set.

5. Start services:
   ```bash
   docker compose up -d
   ```
6. Verify Model Discovery:
   ```bash
   docker exec openclaw-gateway pnpm openclaw models list
   ```
   *Note: If models are not appearing, ensure OLLAMA_HOST is reachable from the container.*

7. Access the dashboard at http://<your-server-ip>:18789

## Architecture Note
OpenClaw uses a dynamic sandbox model. The `openclaw-gateway` container manages the lifecycle of `openclaw-sandbox` containers. 
- You will see new containers appear when an agent starts a task.
- These containers are automatically deleted when the task completes.
- Only the Gateway needs to be running in Docker Compose; it will handle the rest.

## Persistence
All your data will be stored in the `./data` directory.
EOF

echo "==> Zipping bundle..."
cd "$PACKAGE_DIR"
zip -r "../$BUNDLE_NAME" .

echo "=========================================================="
echo "Done! Package created at: dist/$BUNDLE_NAME"
echo "Transfer this file to your production server to deploy."
echo "=========================================================="
