#!/usr/bin/env bash
# scripts/package-source.sh
# Packages OpenClaw source code for build-on-target production deployment

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/dist/source-deploy"
BUNDLE_NAME="openclaw-source.tar.gz"

echo "==> Preparing package directory..."
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

echo "==> Bundling source code..."
# Create a staging area
STAGING_DIR=$(mktemp -d)
cp -r . "$STAGING_DIR/"

# Remove large/unnecessary items from staging
rm -rf "$STAGING_DIR/node_modules"
rm -rf "$STAGING_DIR/dist"
rm -rf "$STAGING_DIR/.git"
rm -rf "$STAGING_DIR/.local_state"
rm -rf "$STAGING_DIR/apps"
rm -rf "$STAGING_DIR/assets"
rm -rf "$STAGING_DIR/Peekaboo"
rm -rf "$STAGING_DIR/Swabble"
rm -rf "$STAGING_DIR/Core"
rm -rf "$STAGING_DIR/Users"
rm -rf "$STAGING_DIR/vendor"

# Overwrite prod config in staging
cp docker-compose.prod.yml "$STAGING_DIR/docker-compose.yml"

# Create .env.example in staging
cat > "$STAGING_DIR/.env.example" <<EOF
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

# Create DEPLOY.md in staging
cat > "$STAGING_DIR/DEPLOY.md" <<'EOF'
# OpenClaw Production Deployment Guide (Build-on-Target)

This bundle contains the source code for OpenClaw. It will be built directly on your production server to ensure 100% compatibility with your OS and architecture.

## Prerequisites
- Docker & Docker Compose installed.
- Internet access (to download base images and dependencies).

## Installation Steps
1. Transfer `openclaw-source.tar.gz` to your server.
2. Extract the bundle:
   ```bash
   mkdir openclaw && tar -xzf openclaw-source.tar.gz -C openclaw
   cd openclaw
   ```
3. Setup environment:
   ```bash
   cp .env.example .env
   # Edit .env and set your password and OLLAMA_HOST
   nano .env
   ```
4. Build and Start:
   ```bash
   docker compose up -d --build
   ```
   *Note: The first build may take 5-10 minutes as it compiles the TypeScript source.*

5. Verify:
   ```bash
   docker exec openclaw-gateway pnpm openclaw models list
   ```

## Troubleshooting
If you get permission errors with `/var/run/docker.sock`:
1. Find GID: `stat -c '%g' /var/run/docker.sock`
2. Update `DOCKER_GID` in `.env`.
3. Run `docker compose up -d` again.
EOF

# Create the final tarball from staging
mkdir -p "$ROOT_DIR/dist"
tar -czf "$ROOT_DIR/dist/$BUNDLE_NAME" -C "$STAGING_DIR" .

# Cleanup
rm -rf "$STAGING_DIR"
rm -rf "$PACKAGE_DIR"

echo "=========================================================="
echo "Done! Package created at: dist/$BUNDLE_NAME"
echo "File size: $(du -h "$ROOT_DIR/dist/$BUNDLE_NAME" | cut -f1)"
echo "Transfer this file to your production server to deploy."
echo "=========================================================="
