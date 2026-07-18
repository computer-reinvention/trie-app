#!/usr/bin/env node
/**
 * Build the bundled sidecar binaries for the trie desktop app.
 *
 * Produces:
 *   resources/opencode-server   — bun-compiled opencode server binary
 *   resources/trie-mcp          — wrapper for the installed trie MCP server
 *   resources/trie-cli          — wrapper for the installed trie CLI
 *
 * Requires the trie package to be installed (uv tool install trie).
 * Run: npm run build:resources
 */

import { execFileSync, execSync } from "child_process"
import { existsSync, chmodSync, mkdirSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { homedir } from "os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir    = resolve(__dirname, "..")
const resDir    = resolve(appDir, "resources")
const forkDir   = resolve(appDir, "opencode", "packages", "opencode")

mkdirSync(resDir, { recursive: true })

// ---------------------------------------------------------------------------
// 1. opencode-server — bun --compile
// ---------------------------------------------------------------------------
console.log("\n[1/2] Building opencode-server (bun --compile)...")

if (!existsSync(resolve(forkDir, "src", "server-entry.ts"))) {
  console.error(`opencode fork not found at ${forkDir}`)
  console.error("Run: git submodule update --init")
  process.exit(1)
}

function findBun() {
  const candidates = ["bun", resolve(homedir(), ".bun", "bin", "bun")]
  for (const c of candidates) {
    try { execFileSync(c, ["--version"], { stdio: "ignore" }); return c } catch {}
  }
  return null
}

const bun = findBun()
if (!bun) {
  console.error("bun not found. Install: curl -fsSL https://bun.sh/install | bash")
  process.exit(1)
}

// Ensure fork deps are installed
console.log("  Installing opencode fork deps...")
execFileSync(bun, ["install", "--ignore-scripts"], { cwd: forkDir, stdio: "inherit" })

// Build the OPENCODE_MIGRATIONS define value by reading migration SQL files
import { readdirSync, readFileSync } from "fs"

const migrationDir = resolve(forkDir, "migration")
const migrationEntries = readdirSync(migrationDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort()
  .map(name => {
    const sqlFile = resolve(migrationDir, name, "migration.sql")
    const sql = existsSync(sqlFile) ? readFileSync(sqlFile, "utf-8") : ""
    // Parse timestamp from directory name (YYYYMMDDHHmmss prefix)
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(name)
    const timestamp = m
      ? Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6])
      : 0
    return { sql, timestamp, name }
  })

// bun --define treats the value as a JS expression, not a string literal.
// JSON.stringify(array) produces valid JSON which is also valid JS array literal.
// Double-stringifying (the old code) produced a string literal at runtime instead of an array.
const migrationsDefine = JSON.stringify(migrationEntries)

console.log("  Compiling opencode-server binary...")
execFileSync(
  bun,
  [
    "build",
    "--compile",
    `--outfile=${resolve(resDir, "opencode-server")}`,
    "--target=bun",
    "--conditions=browser",
    `--define=OPENCODE_MIGRATIONS=${migrationsDefine}`,
    "--define=OPENCODE_VERSION='0.0.0-desktop'",
    "--define=OPENCODE_CHANNEL='stable'",
    "--define=OPENCODE_LIBC=''",
    "./src/server-entry.ts",
  ],
  { cwd: forkDir, stdio: "inherit" }
)
chmodSync(resolve(resDir, "opencode-server"), 0o755)
console.log(`  ✓ resources/opencode-server`)

// ---------------------------------------------------------------------------
// 2. trie-mcp — shell wrapper that delegates to the installed trie package
//
// trie is now an external dependency (pip install trie / uv tool install trie),
// not a sibling checkout. The wrapper bakes in the absolute path to the
// installed `trie-mcp` console script at build time so it survives Electron's
// stripped PATH on macOS app bundles.
//
// Override resolution with TRIE_MCP_BIN / TRIE_BIN env vars at build time.
// ---------------------------------------------------------------------------
console.log("\n[2/2] Writing trie-mcp shell wrapper...")

import { writeFileSync } from "fs"

// Resolve an installed binary at build time. Order: env override, PATH,
// common install locations (uv tool, pipx, homebrew).
function findInstalled(name, envOverride) {
  if (envOverride && existsSync(envOverride)) return envOverride
  try {
    const p = execSync(`command -v ${name}`, { encoding: "utf-8" }).trim()
    if (p) return p
  } catch {}
  const candidates = [
    `${process.env.HOME}/.local/bin/${name}`,
    `${process.env.HOME}/.local/pipx/venvs/trie/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

const trieMcpInstalled = findInstalled("trie-mcp", process.env.TRIE_MCP_BIN)
const trieCliInstalled = findInstalled("trie", process.env.TRIE_BIN)

if (!trieMcpInstalled || !trieCliInstalled) {
  console.error("Installed trie not found (looked for `trie` and `trie-mcp`).")
  console.error("Install it first:  uv tool install trie   (or pip install trie)")
  console.error("Or point the build at a specific install:")
  console.error("  TRIE_BIN=/path/to/trie TRIE_MCP_BIN=/path/to/trie-mcp npm run build:resources")
  process.exit(1)
}

const wrapperPath = resolve(resDir, "trie-mcp")
const wrapperContent = `#!/bin/sh
# trie-mcp wrapper — generated by build-resources.mjs
# Delegates to the installed trie package. Absolute path baked in at build
# time to survive Electron's stripped PATH. TRIE_MCP_BIN overrides at runtime.
exec "\${TRIE_MCP_BIN:-${trieMcpInstalled}}" "$@"
`
writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 })
console.log(`  ✓ resources/trie-mcp (shell wrapper → ${trieMcpInstalled})`)

// ---------------------------------------------------------------------------
// 3. trie-cli — shell wrapper for the trie CLI (refresh/sync)
//
// The desktop app runs `trie-cli refresh --json` on startup so the graph is
// never empty when the canvas loads, and parses the JSONL progress stream to
// drive the triefact-generation status display. The working directory
// (project root) is set by the caller, not baked in, because the CLI
// resolves config + .trie/ from cwd.
// ---------------------------------------------------------------------------
console.log("\n[3/3] Writing trie-cli shell wrapper...")

const cliWrapperPath = resolve(resDir, "trie-cli")
const cliWrapperContent = `#!/bin/sh
# trie-cli wrapper — generated by build-resources.mjs
# Delegates to the installed trie CLI. Absolute path baked in at build time
# to survive Electron's stripped PATH. TRIE_BIN overrides at runtime.
exec "\${TRIE_BIN:-${trieCliInstalled}}" "$@"
`
writeFileSync(cliWrapperPath, cliWrapperContent, { mode: 0o755 })
console.log(`  ✓ resources/trie-cli (shell wrapper → ${trieCliInstalled})`)

console.log("\n✓ All resources built. Ready to npm run build / npm run dist.\n")
