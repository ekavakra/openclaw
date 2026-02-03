import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { authorizeGatewayConnect, type ResolvedGatewayAuth } from "./auth.js";
import { getBearerToken } from "./http-utils.js";
import { sendJson, sendText, sendUnauthorized } from "./http-common.js";
import { loadConfig } from "../config/config.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("gateway:workspace");

export async function handleWorkspaceHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { auth: ResolvedGatewayAuth; trustedProxies?: string[] }
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
  if (!url.pathname.startsWith("/api/workspace")) {
    return false;
  }

  // Auth check
  const token = (getBearerToken(req) ?? url.searchParams.get("token") ?? undefined) as string | undefined;
  const username = url.searchParams.get("username") ?? undefined;
  const authResult = await authorizeGatewayConnect({
    auth: opts.auth,
    connectAuth: { token, password: token, username },
    req,
    trustedProxies: opts.trustedProxies,
  });

  if (!authResult.ok) {
    log.warn(`Unauthorized workspace access attempt: ${authResult.reason}`);
    sendUnauthorized(res);
    return true;
  }

  const config = loadConfig();
  const agentId = url.searchParams.get("agentId") || resolveDefaultAgentId(config);
  const rootWorkspaceDir = resolveAgentWorkspaceDir(config, agentId);

  if (!fs.existsSync(rootWorkspaceDir)) {
    fs.mkdirSync(rootWorkspaceDir, { recursive: true });
  }

  const subPath = url.pathname.slice("/api/workspace".length).replace(/^\/+/, "");
  const queryPath = url.searchParams.get("path") || "";
  const workspaceDir = path.join(rootWorkspaceDir, queryPath);

  // Security: ensure no directory traversal for the directory itself
  if (!workspaceDir.startsWith(rootWorkspaceDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return true;
  }

  // List files: GET /api/workspace
  if (!subPath && req.method === "GET") {
    try {
      const files = fs.readdirSync(workspaceDir).map((name: string) => {
        const fullPath = path.join(workspaceDir, name);
        const stats = fs.statSync(fullPath);
        return {
          name,
          size: stats.size,
          mtime: stats.mtimeMs,
          isDirectory: stats.isDirectory()
        };
      }).filter((f: { isDirectory: boolean; name: string }) => !f.name.startsWith("."));
      sendJson(res, 200, files);
    } catch (err) {
      log.error(`Failed to list workspace: ${err}`);
      sendJson(res, 500, { error: "Failed to list workspace" });
    }
    return true;
  }

  // File operations
  if (subPath) {
    const fileName = decodeURIComponent(subPath);
    const filePath = path.join(workspaceDir, fileName);

    // Security: ensure no directory traversal
    if (!filePath.startsWith(rootWorkspaceDir)) {
      sendJson(res, 403, { error: "Forbidden" });
      return true;
    }

    // Download: GET /api/workspace/:filename
    if (req.method === "GET" && !url.pathname.includes("/text/")) {
      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end("Not Found");
        return true;
      }
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
      return true;
    }

    // Delete: DELETE /api/workspace/:filename
    if (req.method === "DELETE") {
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
        sendJson(res, 200, { ok: true });
      } catch (err) {
        log.error(`Failed to delete: ${err}`);
        sendJson(res, 500, { error: "Failed to delete" });
      }
      return true;
    }

    // Read Text: GET /api/workspace/text/:filename
    if (req.method === "GET" && url.pathname.includes("/text/")) {
      const actualFileName = subPath.replace(/^text\//, "");
      const actualFilePath = path.join(workspaceDir, actualFileName);
      if (!actualFilePath.startsWith(workspaceDir)) {
        sendJson(res, 403, { error: "Forbidden" });
        return true;
      }
      try {
        if (!fs.existsSync(actualFilePath)) {
          res.statusCode = 404;
          res.end("Not Found");
          return true;
        }
        const content = fs.readFileSync(actualFilePath, "utf8");
        sendText(res, 200, content);
      } catch (err) {
        log.error(`Failed to read text file: ${err}`);
        sendJson(res, 500, { error: "Failed to read text file" });
      }
      return true;
    }

    // Write Text: PUT /api/workspace/text/:filename
    if (req.method === "PUT" && url.pathname.includes("/text/")) {
      const actualFileName = subPath.replace(/^text\//, "");
      const actualFilePath = path.join(workspaceDir, actualFileName);
      if (!actualFilePath.startsWith(workspaceDir)) {
        sendJson(res, 403, { error: "Forbidden" });
        return true;
      }
      try {
        let body = "";
        req.on("data", (chunk: any) => { body += chunk; });
        req.on("end", () => {
          fs.writeFileSync(actualFilePath, body, "utf8");
          sendJson(res, 200, { ok: true });
        });
      } catch (err) {
        log.error(`Failed to write text file: ${err}`);
        sendJson(res, 500, { error: "Failed to write text file" });
      }
      return true;
    }
  }

  // Upload: POST /api/workspace/upload
  if (url.pathname === "/api/workspace/upload" && req.method === "POST") {
    try {
      const boundary = req.headers["content-type"]?.split("boundary=")[1];
      if (!boundary) {
        sendJson(res, 400, { error: "Missing boundary" });
        return true;
      }

      // We'll use a simple approach for upload since we don't have busboy
      // For a better implementation, we might want to add busboy later.
      // But for now, let's try to handle it.
      // NOTE: This is a simplified multipart parser.
      
      let body = Buffer.alloc(0);
      req.on("data", (chunk: Buffer) => {
        body = Buffer.concat([body, chunk]);
      });
      
      req.on("end", () => {
        const parts = body.toString("binary").split(`--${boundary}`);
        for (const part of parts) {
          if (part.includes('filename="')) {
            const nameMatch = part.match(/filename="(.+?)"/);
            const fileName = nameMatch ? nameMatch[1] : "uploaded_file";
            const contentStart = part.indexOf("\r\n\r\n") + 4;
            const contentEnd = part.lastIndexOf("\r\n");
            const content = part.slice(contentStart, contentEnd);
            
            const targetPath = path.join(workspaceDir, fileName);
            if (targetPath.startsWith(workspaceDir)) {
              fs.writeFileSync(targetPath, content, "binary");
              log.info(`Uploaded file: ${fileName}`);
            }
          }
        }
        sendJson(res, 200, { ok: true });
      });
      return true;
    } catch (err) {
      log.error(`Upload failed: ${err}`);
      sendJson(res, 500, { error: "Upload failed" });
      return true;
    }
  }

  return false;
}
