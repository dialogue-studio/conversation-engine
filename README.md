# Conversation Engine

A platform-agnostic engine for deterministic, stateful training conversations.

The repository is a pnpm monorepo. The core packages do not depend on a messaging platform; adapters such as the VK Cloudflare Worker translate platform events into engine inputs and engine outputs back into platform messages.

## Workspace

- `apps/vk-worker` — VK adapter deployed as a Cloudflare Worker.
- `packages/core-engine` — platform-independent conversation runtime.
- `packages/scenario-schema` — shared scenario contracts and validation.
- `docs/architecture` — architecture decisions and diagrams.

## Requirements

- Node.js 22 or newer
- Corepack

## Development

```bash
corepack enable
pnpm install
pnpm check
```

Run the Worker locally:

```bash
pnpm --filter @conversation-engine/vk-worker dev
```

## Status

The project is in its bootstrap phase. No proprietary training scenarios or secrets are included.
