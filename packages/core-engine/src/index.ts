import type { Scenario } from '@conversation-engine/scenario-schema';

export function getInitialNode(scenario: Scenario) {
  return scenario.nodes[scenario.initialNodeId];
}
