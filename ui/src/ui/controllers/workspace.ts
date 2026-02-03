import type { OpenClawApp } from "../app";
import type { WorkspaceFile } from "../ui-types";

function addAuthParams(app: OpenClawApp, url: URL) {
  url.searchParams.set("token", app.password || app.settings.token || "");
  const username = app.username || app.settings.username || "";
  if (username) {
    url.searchParams.set("username", username);
  }
  if (app.workspaceCurrentPath) {
    url.searchParams.set("path", app.workspaceCurrentPath);
  }
}

export async function loadWorkspace(app: OpenClawApp) {
  if (!app.connected) return;
  app.workspaceLoading = true;
  app.workspaceError = null;
  try {
    const url = new URL("/api/workspace", window.location.href);
    addAuthParams(app, url);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(await res.text());
    const files = (await res.json()) as WorkspaceFile[];
    // Sort: directories first, then alphabetical
    app.workspaceFiles = files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    app.workspaceError = `Failed to load workspace: ${String(err)}`;
  } finally {
    app.workspaceLoading = false;
  }
}

export async function uploadToWorkspace(app: OpenClawApp, files: FileList) {
  if (!app.connected) return;
  app.workspaceLoading = true;
  try {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    const url = new URL("/api/workspace/upload", window.location.href);
    addAuthParams(app, url);
    const res = await fetch(url.toString(), {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    await loadWorkspace(app);
  } catch (err) {
    app.workspaceError = `Upload failed: ${String(err)}`;
  } finally {
    app.workspaceLoading = false;
  }
}

export function downloadFromWorkspace(app: OpenClawApp, name: string) {
  const fullPath = app.workspaceCurrentPath ? `${app.workspaceCurrentPath}/${name}` : name;
  const url = new URL(`/api/workspace/${encodeURIComponent(fullPath)}`, window.location.href);
  addAuthParams(app, url);
  window.open(url.toString(), "_blank");
}

export async function deleteFromWorkspace(app: OpenClawApp, name: string) {
  if (!app.connected) return;
  app.workspaceLoading = true;
  try {
    const fullPath = app.workspaceCurrentPath ? `${app.workspaceCurrentPath}/${name}` : name;
    const url = new URL(`/api/workspace/${encodeURIComponent(fullPath)}`, window.location.href);
    addAuthParams(app, url);
    const res = await fetch(url.toString(), { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    await loadWorkspace(app);
  } catch (err) {
    app.workspaceError = `Delete failed: ${String(err)}`;
  } finally {
    app.workspaceLoading = false;
  }
}

export async function editInWorkspace(app: OpenClawApp, file: WorkspaceFile) {
  if (!app.connected) return;
  app.workspaceLoading = true;
  try {
    const fullPath = app.workspaceCurrentPath ? `${app.workspaceCurrentPath}/${file.name}` : file.name;
    const url = new URL(`/api/workspace/text/${encodeURIComponent(fullPath)}`, window.location.href);
    addAuthParams(app, url);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(await res.text());
    app.workspaceEditingContent = await res.text();
    app.workspaceEditingFile = file;
  } catch (err) {
    app.workspaceError = `Failed to load file for editing: ${String(err)}`;
  } finally {
    app.workspaceLoading = false;
  }
}

export async function saveInWorkspace(app: OpenClawApp) {
  if (!app.connected || !app.workspaceEditingFile) return;
  app.workspaceSaving = true;
  try {
    const fullPath = app.workspaceCurrentPath ? `${app.workspaceCurrentPath}/${app.workspaceEditingFile.name}` : app.workspaceEditingFile.name;
    const url = new URL(`/api/workspace/text/${encodeURIComponent(fullPath)}`, window.location.href);
    addAuthParams(app, url);
    const res = await fetch(url.toString(), {
      method: "PUT",
      body: app.workspaceEditingContent,
    });
    if (!res.ok) throw new Error(await res.text());
    app.workspaceEditingFile = null;
    app.workspaceEditingContent = "";
    await loadWorkspace(app);
  } catch (err) {
    app.workspaceError = `Save failed: ${String(err)}`;
  } finally {
    app.workspaceSaving = false;
  }
}
