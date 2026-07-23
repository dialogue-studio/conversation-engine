import type {
  Scenario,
  ScenarioNode,
} from '@conversation-engine/scenario-schema';

import { ScenarioNodeNotFoundError } from './engine.ts';

export {
  ActionUnavailableError,
  ConversationEngine,
  InvalidFinishTransitionError,
  ProgressNotFoundError,
  ProgressScenarioMismatchError,
  ScenarioNodeNotFoundError,
  ScenarioNotFoundError,
} from './engine.ts';
export type { Clock, ConversationEngineOptions } from './engine.ts';

export type {
  Scenario,
  ScenarioNode,
} from '@conversation-engine/scenario-schema';

/** A platform-independent reference to the person taking part in a conversation. */
export interface ParticipantRef {
  readonly id: string;
}

/** Identifies one immutable, published scenario version. */
export interface ScenarioReference {
  readonly scenarioId: string;
  readonly version: number;
}

export type ProgressStatus = 'completed' | 'in_progress' | 'incomplete';

/**
 * Persisted state of one participant in one scenario version.
 * Timestamps are ISO 8601 strings so storage adapters do not need a shared Date type.
 */
export interface ScenarioProgress {
  readonly completedAt?: string;
  readonly completedObjectiveIds: readonly string[];
  readonly currentNodeId: string;
  readonly participant: ParticipantRef;
  readonly scenario: ScenarioReference;
  readonly startedAt: string;
  readonly status: ProgressStatus;
  readonly updatedAt: string;
  readonly usedHintActionIds: readonly string[];
  readonly visitedNodeIds: readonly string[];
}

export interface StartScenarioInput {
  readonly kind: 'start_scenario';
  readonly participant: ParticipantRef;
  readonly scenario: ScenarioReference;
}

export interface SelectActionInput {
  readonly actionId: string;
  readonly kind: 'select_action';
  readonly participant: ParticipantRef;
  readonly scenario: ScenarioReference;
}

export interface RestartScenarioInput {
  readonly kind: 'restart_scenario';
  readonly participant: ParticipantRef;
  readonly scenario: ScenarioReference;
}

/** All platform adapters translate their incoming events into this union. */
export type EngineInput =
  RestartScenarioInput | SelectActionInput | StartScenarioInput;

export interface EngineMessage {
  readonly speaker?: string;
  readonly text: string;
}

/** A platform adapter turns an available action into a platform-specific button. */
export interface EngineAction {
  readonly id: string;
  readonly label: string;
}

/**
 * The result of a single engine transition. It deliberately contains no VK,
 * Telegram, HTTP, or Cloudflare-specific data.
 */
export interface EngineOutput {
  readonly actions: readonly EngineAction[];
  readonly messages: readonly EngineMessage[];
  readonly progress: ScenarioProgress;
}

/** Supplies immutable scenario content from any storage or delivery mechanism. */
export interface ScenarioRepository {
  getById(reference: ScenarioReference): Promise<Scenario | null>;
}

/** Stores per-participant progress without making the engine depend on a database. */
export interface ProgressRepository {
  get(
    participant: ParticipantRef,
    scenario: ScenarioReference,
  ): Promise<ScenarioProgress | null>;
  save(progress: ScenarioProgress): Promise<void>;
}

/**
 * Returns the first node of a structurally valid scenario.
 *
 * Scenario files are validated before runtime. This guard still makes an
 * invalid programmatic scenario fail at its boundary instead of returning an
 * unexpected `undefined` to an engine caller.
 */
export function getInitialNode(scenario: Scenario): ScenarioNode {
  const node = scenario.nodes[scenario.initialNodeId];

  if (!node) {
    throw new ScenarioNodeNotFoundError(scenario.id, scenario.initialNodeId);
  }

  return node;
}
