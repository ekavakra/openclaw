# AGENTS.md - OpenClaw Agent Guidelines

Repository: https://github.com/openclaw/openclaw

## Build, Test & Development Commands

- **Install deps:** `pnpm install` (also supports `bun install`)
- **Build:** `pnpm build` (runs type-check + canvas bundle + build scripts)
- **Type-check only:** `tsc -p tsconfig.json --noEmit`
- **Lint:** `pnpm lint` (oxlint --type-aware) | `pnpm lint:fix` (auto-fix)
- **Format:** `pnpm format` (oxfmt --check) | `pnpm format:fix` (write)
- **Full check:** `pnpm check` (tsgo + lint + format)

### Testing

- **Run all tests:** `pnpm test` (parallel test runner)
- **Run single test:** `pnpm vitest run src/path/to/file.test.ts`
- **Watch mode:** `pnpm test:watch` or `pnpm vitest`
- **Coverage:** `pnpm test:coverage`
- **E2E tests:** `pnpm test:e2e`
- **Live tests (real APIs):** `CLAWDBOT_LIVE_TEST=1 pnpm test:live`

**Test conventions:**
- Tests are colocated with source files: `*.test.ts`
- E2E tests: `*.e2e.test.ts`
- Framework: Vitest with V8 coverage
- Coverage thresholds: 70% (lines/branches/functions/statements)

### Development

- **Run CLI in dev:** `pnpm openclaw ...` or `pnpm dev`
- **Gateway dev mode:** `pnpm gateway:dev`
- **Prefer Bun for TS execution:** `bun <file.ts>` or `bunx <tool>`

## Project Structure

```
src/
  cli/          # CLI wiring and UI components
  commands/     # Command implementations
  infra/        # Shared infrastructure (errors, retry, etc.)
  media/        # Media processing pipeline
  channels/     # Channel abstractions and registry
  telegram/     # Telegram channel implementation
  discord/      # Discord channel implementation
  slack/        # Slack channel implementation
  signal/       # Signal channel implementation
  imessage/     # iMessage channel implementation
  web/          # WhatsApp Web (Baileys) implementation
  providers/    # AI provider implementations
  config/       # Configuration management
  logging/      # Logging infrastructure
  utils/        # Shared utilities
dist/           # Compiled output
docs/           # Mintlify documentation
extensions/     # Plugin packages (workspace)
```

## Code Style Guidelines

### TypeScript & Types

- **Language:** TypeScript (ESM strict mode)
- **Target:** ES2023, Node 22+
- **Avoid:** `any` type - use `unknown` with type guards instead
- **Strict mode:** Enabled (null checks, strict types, etc.)
- **Custom errors:** Extend `Error` with a `code` property for programmatic handling

### Imports (ordered)

```typescript
// 1. Node.js built-ins
import fs from "node:fs/promises";
import path from "node:path";

// 2. Third-party packages
import { Bot } from "grammy";
import chalk from "chalk";

// 3. Type imports from local files
import type { Config } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";

// 4. Regular imports from local files
import { loadConfig } from "../config/config.js";
import { formatError } from "../infra/errors.js";
```

### Naming Conventions

- **Files:** kebab-case (e.g., `send-reactions.ts`, `media-fetch.ts`)
- **Types/Interfaces:** PascalCase (e.g., `MediaFetchResult`, `ConfigOptions`)
- **Functions/Variables:** camelCase (e.g., `fetchMedia`, `resolveTarget`)
- **Constants:** UPPER_SNAKE_CASE for true constants (e.g., `MAX_RETRY_ATTEMPTS`)
- **Classes:** PascalCase (e.g., `MediaFetchError`)
- **Product name:** "OpenClaw" (docs/headings), "openclaw" (CLI/package/paths)

### Error Handling & Utils

- Use custom error classes extending `Error` with a `readonly code` property
- Export error codes as string literal types (e.g., `MediaFetchErrorCode`)
- Use `formatErrorMessage` from `src/infra/errors.ts` for consistent error display
- Use `retryAsync` from `src/infra/retry.ts` for flaky operations
- Avoid throwing in library code; prefer returning `Result` types when appropriate

### File Organization

- Keep files under ~500-700 LOC; split when readability suffers
- Colocate tests: `file.ts` + `file.test.ts`
- Extract helpers instead of creating "V2" copies
- Add brief comments for tricky or non-obvious logic

### Linting & Formatting

- **Linter:** Oxlint with type-aware rules
- **Formatter:** Oxfmt
- Run `pnpm check` before commits
- CI enforces the same checks as `pnpm check`

## Testing Guidelines

- Vitest framework with V8 coverage
- Tests live next to source files: `*.test.ts`
- E2E tests use separate config: `*.e2e.test.ts`
- Mock external dependencies; test logic in isolation
- Run `pnpm test` before pushing changes

## Git & PR Workflow

- **Commits:** Use `scripts/committer "<msg>" <files...>` for scoped staging. It unstages everything first to prevent accidental commits.
- **Commit format:** Concise, action-oriented (e.g., `CLI: add verbose flag`)
- **PR workflow:**
  - Review mode: `gh pr view/diff` only (no branch switching)
  - Landing mode: Create temp branch from main, merge PR, run checks, merge back
  - Prefer **rebase** for clean history, **squash** for messy history

## Critical Conventions

- **Never edit `node_modules`** - changes are ephemeral
- **Never commit:** Real phone numbers, videos, live config values, secrets
- **Dependencies with patches:** Use exact versions only (no `^`/`~`)
- **Multi-agent safety:**
  - Don't create/remove git stashes unless explicitly asked
  - Don't switch branches unless explicitly asked
  - Don't modify `.worktrees/` unless explicitly asked
  - Focus reports on your edits; note other files only if relevant
- **Typebox schemas:** Avoid `Type.Union`, use `stringEnum`/`optionalStringEnum`. No `format` property names.

## Documentation

- Docs hosted on Mintlify (docs.openclaw.ai)
- Internal links: root-relative without `.md` (e.g., `[Config](/configuration)`)
- Headings: Avoid em dashes and apostrophes (break Mintlify anchors)
- Use generic placeholders (e.g., `user@gateway-host`) not personal device names
