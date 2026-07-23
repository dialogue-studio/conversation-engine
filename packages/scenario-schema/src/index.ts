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
  readonly actionId: string;
  readonly kind: TransitionKind;
  readonly label: string;
  readonly targetNodeId: string;
}

export interface ScenarioNode {
  readonly completesObjectiveIds: readonly string[];
  readonly id: string;
  readonly message: string;
  readonly kind: ScenarioNodeKind;
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
