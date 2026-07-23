# Core contracts

`core-engine` owns the platform-independent contract for a single conversation
transition. It knows how to work with scenario content and participant progress;
it never imports a chat platform SDK, HTTP framework, Cloudflare binding, or
database client.

## Scenario content

A `Scenario` is an immutable, versioned graph.

- A `ScenarioNode` is a message shown to a participant.
- A `Transition` is an action offered from one node to another.
- A `ScenarioObjective` is a learning outcome such as “understand the data
  sources”. Nodes can complete objectives; transitions can require already
  completed objectives before they become available.
- A `completion` node ends the conversation. The future engine will set progress
  to `completed` only when all required objectives are complete; otherwise it
  records an `incomplete` completion. Authors may therefore offer an early
  “Finish conversation” action without trapping a participant.

The author-facing UI uses titles and labels. Stable IDs link nodes, objectives,
and transitions so renaming a step cannot break the graph.

## Runtime boundary

Every chat adapter maps its event to `EngineInput` and maps `EngineOutput` back
to messages and buttons for its own platform.

```text
VK / Telegram event
        ↓
    EngineInput
        ↓
Conversation Engine
        ↓
   EngineOutput
        ↓
platform messages and buttons
```

`ScenarioRepository` provides an immutable published scenario version.
`ProgressRepository` persists one participant’s progress for that version.
The first Cloudflare implementation may use KV for published content and D1 for
progress, but neither storage choice is part of the core contract.

## Application boundary

`User`, `Workspace`, `WorkspaceMembership`, `Project`, `Bot`, and
`ChannelConnection` belong to the Scenario Studio application, not to the
conversation engine. They decide which published scenario version a participant
starts and which platform connection delivers the output. The engine receives
only a `ParticipantRef` and a `ScenarioReference`, which keeps it reusable for
students, employees, customers, and future platforms.
