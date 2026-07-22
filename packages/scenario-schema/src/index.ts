export interface Transition {
  readonly actionId: string;
  readonly targetNodeId: string;
}

export interface ScenarioNode {
  readonly id: string;
  readonly message: string;
  readonly transitions: readonly Transition[];
}

export interface Scenario {
  readonly id: string;
  readonly initialNodeId: string;
  readonly nodes: Readonly<Record<string, ScenarioNode>>;
  readonly schemaVersion: 1;
}
