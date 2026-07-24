/**
 * A learning outcome that a scenario can require before it is fully completed.
 * Authors work with its title in the editor; IDs remain stable when titles change.
 */
export interface ScenarioObjective {
  readonly id: string;
  readonly required: boolean;
  readonly title: string;
}

export type ScenarioNodeKind = 'completion' | 'message';

export type TransitionKind = 'choice' | 'finish' | 'hint' | 'navigation';

/**
 * Conditions that control whether a transition is offered to a participant.
 * All listed objectives must have been completed for the transition to unlock.
 */
export interface TransitionAvailability {
  readonly requiresCompletedObjectiveIds?: readonly string[];
}

export interface Transition extends TransitionAvailability {
  /**
   * Stable, scenario-wide unique action identifier. It is safe to persist in
   * participant progress, including for hint usage.
   */
  readonly actionId: string;
  /**
   * Completion is determined by the target node. A `finish` transition must
   * target a completion node; the runtime rejects the inverse mismatch.
   *
   * A `hint` transition points to a regular message node that contains the hint
   * content and any available follow-up actions. Hint text never lives on the
   * transition itself.
   */
  readonly kind: TransitionKind;
  readonly label: string;
  readonly targetNodeId: string;
}

export interface ScenarioNode {
  readonly completesObjectiveIds: readonly string[];
  readonly id: string;
  readonly kind: ScenarioNodeKind;
  readonly message: string;
  readonly speaker?: string;
  readonly title: string;
  readonly transitions: readonly Transition[];
}

export interface Scenario {
  readonly description?: string;
  readonly id: string;
  readonly initialNodeId: string;
  readonly nodes: Readonly<Record<string, ScenarioNode>>;
  readonly objectives: readonly ScenarioObjective[];
  readonly schemaVersion: 1;
  readonly title: string;
  /** Immutable content version chosen by a project when it is published. */
  readonly version: number;
}

export type {
  ScenarioValidationIssue,
  ScenarioValidationResult,
} from './validator.js';
export { validateScenario } from './validator.js';
