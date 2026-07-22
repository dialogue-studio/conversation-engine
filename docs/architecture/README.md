# Architecture

The system follows a ports-and-adapters boundary around a platform-independent core.

```text
Platform webhook -> adapter -> engine input -> core engine
                                               |
Platform API     <- adapter <- engine output <-+
```

## Dependency rule

- `core-engine` may depend on `scenario-schema`.
- Platform adapters may depend on both core packages.
- Core packages must not import Hono, Cloudflare, VK, Telegram, or another platform SDK.

## Planned decisions

Architecture decisions will be recorded as ADRs as the scenario contract, persistence port, VK payloads, and runtime validation are implemented.
