# Docker Production Deployment

This guide explains the production architecture of OpenClaw and how to deploy it using Docker.

## Architecture

OpenClaw follows an **Orchestrator-Worker** pattern:

1.  **Gateway (Orchestrator):** The primary long-running service. It manages authentication, the web dashboard, and agent coordination. It requires access to the host's Docker socket (`/var/run/docker.sock`) to manage workers.
2.  **Sandboxes (Workers):** Dynamic containers spawned on-demand by the Gateway.
    -   **Isolated:** Each agent task gets a fresh sandbox.
    -   **Ephemeral:** Containers are destroyed immediately after use to ensure security and resource efficiency.
    -   **Networking:** Workers run on an internal Docker network (`openclaw-net`) and communicate with the Gateway via internal IPs.

## Deployment Methods

There are two ways to deploy OpenClaw:

### Option A: Build-on-Target (Recommended)
This method transfers the source code and builds the images directly on the production server. This is the **most reliable** method if your production server has a different architecture (e.g., Linux AMD64) than your development machine (e.g., Mac ARM64).

1.  **Build the Package:**
    ```bash
    ./scripts/package-source.sh
    ```
    This produces a small (~10MB) `dist/openclaw-source.tar.gz`.

2.  **Transfer and Extract:**
    Transfer the file to your server and extract it:
    ```bash
    mkdir openclaw && tar -xzf openclaw-source.tar.gz -C openclaw
    cd openclaw
    ```

3.  **Deploy:**
    Follow the instructions in the generated `DEPLOY.md` (configure `.env` and run `docker compose up -d --build`).

### Option B: Pre-built Images
This method builds images locally and transfers them as large tarballs. 

1.  **Build the Package:**
    ```bash
    ./scripts/package-prod.sh
    ```
    This produces a large (~1GB) `dist/openclaw-deploy.zip`.

2.  **Deploy:**
    Follow the instructions in the generated `DEPLOY.md` (load images with `docker load` and run `docker compose up -d`).

*Note: If you use this method and your server architecture differs from your local machine, the containers will fail to start.*

## Configuration

Check that the Gateway is running and can discover your models:
```bash
docker exec openclaw-gateway pnpm openclaw models list
```

## Security Best Practices

- **Firewall:** Ensure only port `18789` (and `18790` for the control UI) are open to your trusted IP addresses.
- **Docker Socket:** Running the Gateway as a non-root user is recommended. Follow the instructions in `DEPLOY.md` (inside the package) to set the `DOCKER_GID`.
- **Secrets:** Never commit your `.env` file to version control.
