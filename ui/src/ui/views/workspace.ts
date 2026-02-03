import { html, nothing } from "lit";
import { icons } from "../icons";
import type { WorkspaceFile } from "../ui-types";

export type WorkspaceProps = {
  files: WorkspaceFile[];
  loading: boolean;
  error: string | null;
  editingFile: WorkspaceFile | null;
  editingContent: string;
  saving: boolean;
  currentPath: string;
  searchQuery: string;
  onRefresh: () => void;
  onUpload: (files: FileList) => void;
  onDownload: (name: string) => void;
  onDelete: (name: string) => void;
  onEdit: (file: WorkspaceFile) => void;
  onSave: () => void;
  onEditCancel: () => void;
  onEditContentChange: (content: string) => void;
  onPathChange: (path: string) => void;
  onSearchChange: (query: string) => void;
};

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(mtime: number): string {
  return new Date(mtime).toLocaleString();
}

export function renderWorkspace(props: WorkspaceProps) {
  if (props.editingFile) {
    return renderEditor(props);
  }

  const filteredFiles = props.files.filter(f => 
    f.name.toLowerCase().includes(props.searchQuery.toLowerCase())
  );

  const breadcrumbs = props.currentPath.split("/").filter(Boolean);

  return html`
    <div class="workspace-view">
      <div class="workspace-header">
        <div class="workspace-nav-box">
          <div class="workspace-breadcrumbs">
            <button class="breadcrumb-item" @click=${() => props.onPathChange("")}>
              ${icons.folder} workspace
            </button>
            ${breadcrumbs.map((part, i) => html`
              <span class="breadcrumb-separator">/</span>
              <button class="breadcrumb-item" @click=${() => props.onPathChange(breadcrumbs.slice(0, i + 1).join("/"))}>
                ${part}
              </button>
            `)}
          </div>
          <div class="workspace-search">
            <input 
              type="text" 
              placeholder="Search files..." 
              .value=${props.searchQuery}
              @input=${(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>
        <div class="workspace-actions">
          <button class="btn" @click=${props.onRefresh} ?disabled=${props.loading}>
            ${icons.refresh} <span class="btn-text">Refresh</span>
          </button>
          <label class="btn primary">
            ${icons.upload} <span class="btn-text">Upload</span>
            <input
              type="file"
              multiple
              style="display: none"
              @change=${(e: Event) => {
                const input = e.target as HTMLInputElement;
                if (input.files) props.onUpload(input.files);
                input.value = "";
              }}
            />
          </label>
        </div>
      </div>

      ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}

      <div class="table workspace-table">
        <div class="table-head">
          <div class="workspace-col-name">Name</div>
          <div class="workspace-col-size">Size</div>
          <div class="workspace-col-mtime">Modified</div>
          <div class="workspace-col-actions text-right">Actions</div>
        </div>
        
        ${props.currentPath ? html`
          <div class="table-row workspace-row-dir" @click=${() => {
            const parts = props.currentPath.split("/");
            parts.pop();
            props.onPathChange(parts.join("/"));
          }}>
            <div class="workspace-file-name">
              ${icons.cornerUpLeft} ..
            </div>
            <div class="muted">--</div>
            <div class="muted">--</div>
            <div class="text-right"></div>
          </div>
        ` : nothing}

        ${filteredFiles.length === 0 && !props.loading
          ? html`<div class="muted text-center" style="padding: 20px;">No files found</div>`
          : filteredFiles.map(
              (file) => html`
                <div class="table-row ${file.isDirectory ? "workspace-row-dir" : ""}" 
                     @click=${file.isDirectory ? () => props.onPathChange(props.currentPath ? `${props.currentPath}/${file.name}` : file.name) : nothing}>
                  <div class="workspace-file-name">
                    ${file.isDirectory ? icons.folder : icons.fileText} ${file.name}
                  </div>
                  <div class="muted workspace-col-size">${file.isDirectory ? "--" : formatSize(file.size)}</div>
                  <div class="muted workspace-col-mtime">${formatDate(file.mtime)}</div>
                  <div class="text-right workspace-col-actions">
                    <div class="btn-group" @click=${(e: Event) => e.stopPropagation()}>
                      ${!file.isDirectory ? html`
                        <button class="btn btn--sm" @click=${() => props.onDownload(file.name)} title="Download">
                          ${icons.download}
                        </button>
                        ${isEditable(file.name)
                          ? html`
                              <button class="btn btn--sm" @click=${() => props.onEdit(file)} title="Edit">
                                ${icons.edit}
                              </button>
                            `
                          : nothing}
                      ` : nothing}
                      <button class="btn btn--sm danger" @click=${() => {
                        if (confirm(`Delete ${file.name}${file.isDirectory ? " and all its contents" : ""}?`)) props.onDelete(file.name);
                      }} title="Delete">
                        ${icons.trash}
                      </button>
                    </div>
                  </div>
                </div>
              `
            )}
      </div>
    </div>
  `;
}

function isEditable(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase();
  return ["txt", "md", "json", "js", "ts", "py", "sh", "yml", "yaml"].includes(ext || "");
}

function renderEditor(props: WorkspaceProps) {
  return html`
    <div class="workspace-editor">
      <div class="workspace-editor-header">
        <div class="workspace-editor-title">
          ${icons.edit} Editing: <strong>${props.editingFile?.name}</strong>
        </div>
        <div class="workspace-editor-actions">
          <button class="btn" @click=${props.onEditCancel} ?disabled=${props.saving}>Cancel</button>
          <button class="btn primary" @click=${props.onSave} ?disabled=${props.saving}>
            ${props.saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <textarea
        class="workspace-editor-textarea"
        .value=${props.editingContent}
        @input=${(e: Event) => props.onEditContentChange((e.target as HTMLTextAreaElement).value)}
        spellcheck="false"
      ></textarea>
    </div>
  `;
}
