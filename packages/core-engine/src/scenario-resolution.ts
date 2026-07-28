import type { Scenario, ScenarioNode } from '@dialogue-studio/scenario-schema';

import type { ScenarioReference, ScenarioRepository } from './index.js';

export class ScenarioNotFoundError extends Error {
  constructor(reference: ScenarioReference) {
    super(
      `Scenario "${reference.scenarioId}" version ${String(reference.version)} was not found.`,
    );
    this.name = 'ScenarioNotFoundError';
  }
}

export class ScenarioNodeNotFoundError extends Error {
  constructor(scenarioId: string, nodeId: string) {
    super(`Scenario "${scenarioId}" is missing node "${nodeId}".`);
    this.name = 'ScenarioNodeNotFoundError';
  }
}

export async function getScenario(
  scenarioRepository: ScenarioRepository,
  reference: ScenarioReference,
): Promise<Scenario> {
  const scenario = await scenarioRepository.getById(reference);

  if (!scenario) {
    throw new ScenarioNotFoundError(reference);
  }

  return scenario;
}

export function getNode(scenario: Scenario, nodeId: string): ScenarioNode {
  const node = scenario.nodes[nodeId];

  if (!node) {
    throw new ScenarioNodeNotFoundError(scenario.id, nodeId);
  }

  return node;
}

export function getInitialNode(scenario: Scenario): ScenarioNode {
  return getNode(scenario, scenario.initialNodeId);
}
