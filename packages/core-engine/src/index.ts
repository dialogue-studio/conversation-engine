import type {
  Scenario,
  ScenarioNode,
} from '@conversation-engine/scenario-schema';

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
    throw new Error(
      `Scenario "${scenario.id}" is missing its initial node "${scenario.initialNodeId}".`,
    );
  }

  return node;
}
