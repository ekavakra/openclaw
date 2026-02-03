import { html } from "lit";
import { icons } from "../icons";

export type LoginProps = {
  username: string;
  password: string;
  lastError: string | null;
  onUsernameChange: (next: string) => void;
  onPasswordChange: (next: string) => void;
  onLogin: () => void;
};

export function renderLogin(props: LoginProps) {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      props.onLogin();
    }
  };

  return html`
    <div class="login-layout">
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">
            <img src="/favicon.svg" alt="OpenClaw" />
          </div>
          <div class="login-title">OPENCLAW</div>
          <div class="login-sub">Dashboard Login</div>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>Username</span>
            <input
              type="text"
              .value=${props.username}
              @input=${(e: Event) => props.onUsernameChange((e.target as HTMLInputElement).value)}
              @keydown=${handleKeydown}
              placeholder="Username"
              autofocus
            />
          </label>
          <label class="field">
            <span>Password</span>
            <input
              type="password"
              .value=${props.password}
              @input=${(e: Event) => props.onPasswordChange((e.target as HTMLInputElement).value)}
              @keydown=${handleKeydown}
              placeholder="Password"
            />
          </label>
        </div>

        ${props.lastError ? html`
          <div class="callout danger" style="margin-top: 16px;">
            ${props.lastError}
          </div>
        ` : ""}

        <div class="login-actions" style="margin-top: 24px;">
          <button class="btn primary btn--lg" @click=${props.onLogin} style="width: 100%;">
            Connect
          </button>
        </div>

        <div class="login-footer">
          <a class="session-link" href="https://docs.openclaw.ai" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
      </div>
    </div>
  `;
}
