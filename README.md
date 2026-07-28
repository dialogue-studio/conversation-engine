# Conversation Engine

A platform-agnostic engine for deterministic conversation scenarios.

The core packages do not depend on a messaging platform. Platform adapters live
in their own repositories and translate provider events into engine inputs and
engine outputs back into provider messages.

## Workspace

- `packages/core-engine` — platform-independent conversation runtime.
- `packages/scenario-schema` — shared scenario contracts and validation.
- `docs/architecture` — architecture decisions and diagrams.

`core-engine` and `scenario-schema` emit ESM and declaration files to `dist`.
They are ready to be packed and consumed by a separate adapter repository. A
registry publication remains a separate operational decision: it requires an
approved package owner and release credentials.

## Requirements

- Node.js 22 or newer
- Corepack

## Development

```bash
corepack enable
pnpm install
pnpm check
```

## Status

The project contains reusable contracts only. No proprietary training scenarios,
provider credentials, or adapters are included.
