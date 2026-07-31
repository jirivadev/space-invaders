# AGENTS.md

## Behavioral guidelines

See @EXAMPLES.md for common LLM pitfalls and fixes specific to this repo's style.

## Commands

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Full build (typecheck → bundle) | `npm run build` |
| Preview prod build | `npm run preview` |
| Run all tests | `npm test` (vitest run) |
| Tests in watch mode | `npx vitest` |
| Format all | Pre-commit via `lint-staged` (husky) |

Pre-commit runs `prettier --write` on staged files then `npm run test`.
