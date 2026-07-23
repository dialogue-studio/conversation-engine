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
- A `hint` transition points to a normal message node containing the hint and
  its follow-up actions. The transition itself deliberately stores no hint text;
  this lets a hint behave like any other part of the graph and lets progress
  record its stable, scenario-wide unique `actionId`.
- Completion is determined by the target node, not by a button label alone. A
  `finish` transition must target a `completion` node; the runtime rejects that
  mismatch even before the full scenario validator is added.
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

`EngineAction` intentionally exposes only a stable action ID and visible label.
`hint`, `navigation`, and other authoring semantics belong to the scenario
schema and are resolved by the engine; a VK or Telegram adapter does not need to
know them to render a button and send its payload.

## Runtime behavior

`ConversationEngine` is deterministic and performs one transition per
`EngineInput`.

- `start_scenario` resumes an `in_progress` attempt; a completed or incomplete
  attempt starts again from the initial node.
- `restart_scenario` always replaces progress with a new attempt from the
  initial node.
- `select_action` accepts only actions available on the current node. A
  transition with `requiresCompletedObjectiveIds` is absent from the output and
  cannot be invoked through a stale platform payload until all of its objectives
  are complete.
- Entering a node records it as visited and completes its declared objectives.
- Entering a `completion` node finishes the attempt. It is `completed` only if
  every required objective is complete; otherwise it is `incomplete`.

## Runtime validation

The current interfaces are compile-time contracts only. IDs remain plain strings
because scenario content is serialized JSON and must be supplied by an editor,
an importer, or a storage adapter. A later scenario validator and JSON Schema
will reject duplicate IDs, missing targets, missing objectives, invalid terminal
nodes, and inconsistent hint transitions before publication. Until that work is
implemented, callers must treat externally loaded scenarios as untrusted.

The runtime additionally verifies that a `ProgressRepository` returns progress
for the exact `ScenarioReference` requested by an input. A correct repository
keys progress by participant, scenario ID, and version; the explicit guard turns
an incorrect adapter implementation into a domain error instead of resolving a
node ID against an unrelated scenario version.

## Application boundary

`User`, `Workspace`, `WorkspaceMembership`, `Project`, `Bot`, and
`ChannelConnection` belong to the Scenario Studio application, not to the
conversation engine. They decide which published scenario version a participant
starts and which platform connection delivers the output. The engine receives
only a `ParticipantRef` and a `ScenarioReference`, which keeps it reusable for
students, employees, customers, and future platforms.
