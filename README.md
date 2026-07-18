# trie desktop (experimental)

An attention-map editor for [trie](https://github.com/computer-reinvention/trie): watch where your coding agent is "thinking" on a live map of the codebase, review symbol-level patches as prose, and drive multi-session agent chat — all on top of the trie context layer.

> **Status: experimental research app.** macOS only. Expect rough edges. The stable, supported product is the [trie](https://github.com/computer-reinvention/trie) CLI + MCP server (MIT).

## Architecture

```
Electron app ──► opencode fork HTTP API (/desktop routes, SSE)
                        │
                        ▼
                  trie MCP server ──► trie (Python) ──► your codebase
```

- **trie** is an external dependency, consumed via its installed `trie` / `trie-mcp` binaries.
- The `opencode/` submodule is a fork of opencode where trie tools are the agent's default toolset; it also serves the `/desktop` route group (graph queries + SSE event stream) that feeds the canvas.

## Prerequisites

- [trie](https://github.com/computer-reinvention/trie) installed: `uv tool install trie` (or `pip install trie`)
- [bun](https://bun.sh) (compiles the opencode-server sidecar)
- Node 20+
- An Anthropic API key (set in the app's settings on first run)

## Development

```bash
git submodule update --init   # opencode fork
npm install                   # also installs fork deps via bun
npm run dev                   # builds sidecars + launches electron-vite dev
```

If `trie` / `trie-mcp` are not on your PATH, point the sidecar build at them:

```bash
TRIE_BIN=/path/to/trie TRIE_MCP_BIN=/path/to/trie-mcp npm run build:resources
```

## Testing

```bash
npm test          # vitest
npm run typecheck
```

## Packaging

```bash
npm run dist      # build:resources + electron-builder
```
