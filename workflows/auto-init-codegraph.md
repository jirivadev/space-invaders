# Workflow: Auto-init CodeGraph

## Loop

Every time opencode launches in a project directory, ensure codegraph is initialized so the daemon can keep the index fresh.

## Trigger

**Event** — opencode process starts (detected by shell wrapper).

## Action

1. Check if `.codegraph/` directory exists in the current directory.
2. If it does not exist, run `codegraph init --quiet` (or `codegraph init` with output suppressed).
3. Launch opencode normally.

The daemon started by `codegraph serve --mcp` (configured as an MCP server in opencode) handles all subsequent index syncing automatically.

## Checkpoint

None. Fully autonomous.

## Implementation

Shell wrapper — a bash function or alias that replaces `opencode`:

```bash
opencode() {
  if [ -d .git ] && [ ! -d .codegraph ]; then
    codegraph init --quiet 2>/dev/null
  fi
  command opencode "$@"
}
```

Place in `~/.bashrc` or `~/.zshrc` depending on the user's shell.

## Definition of Done

An implementer agent can:
- Add the wrapper function to the user's shell config.
- Verify it works by launching opencode in a fresh repo without `.codegraph/`.
