# NOTES.md — Raw notes on the user's world

## Tools
- **opencode** — primary coding agent interface (slash commands: `/exit`, `/new`, etc.)
- **codegraph** — code intelligence / knowledge graph for codebases. CLI installed globally. Key commands: `codegraph sync` (incremental), `codegraph index` (full rebuild), `codegraph init` (first-time setup). Runs a daemon per project.
- Projects live under `/home/azureuser/codeopen/` (at minimum `projectone`)

## Channels
_(to be discovered)_

## Terminology
- `/exit` — opencode slash command to end a session
- `/new` — opencode slash command to start a new session
- "codegraph sync" — `codegraph sync [path]`, incremental re-index since last sync

## Loops identified (raw)
1. ~~Run `codegraph sync` after every `/exit` and `/new`~~ — resolved: daemon handles sync automatically; real gap is auto-init for new repos.

## Loops specified
- `workflows/auto-init-codegraph.md` — auto-init codegraph when opencode launches in a project without `.codegraph/`
