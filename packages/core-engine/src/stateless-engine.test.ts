import type {
  Scenario,
  ScenarioNode,
  Transition,
} from '@dialogue-studio/scenario-schema';
import { describe, expect, it } from 'vitest';

import {
  DuplicateStatelessActionError,
  InvalidFinishTransitionError,
  ScenarioNodeNotFoundError,
  ScenarioNotFoundError,
  StatelessActionNotFoundError,
  StatelessConversationEngine,
} from './index.ts';
import type { ScenarioReference, ScenarioRepository } from './index.ts';

const reference: ScenarioReference = { scenarioId: 'support', version: 1 };

const scenario = {
  id: reference.scenarioId,
  initialNodeId: 'intro',
  nodes: {
    intro: {
      attachments: [
        {
          kind: 'photo',
          source: {
            kind: 'external_url',
            url: 'https://assets.example.com/welcome.jpg',
          },
        },
      ],
      buttonLayout: { columns: 2 },
      completesObjectiveIds: [],
      id: 'intro',
      kind: 'message',
      message: 'How can I help?',
      messageFormat: 'plain',
      title: 'Introduction',
      transitions: [
        {
          actionId: 'open-order',
          kind: 'choice',
          label: 'My order',
          targetNodeId: 'order',
        },
      ],
    },
    order: {
      completesObjectiveIds: [],
      id: 'order',
      kind: 'message',
      message: 'Tell me your order number.',
      speaker: 'Support',
      title: 'Order',
      transitions: [],
    },
  },
  objectives: [],
  schemaVersion: 1,
  title: 'Support',
  version: reference.version,
} as const satisfies Scenario;

class InMemoryScenarioRepository implements ScenarioRepository {
  getById(currentReference: ScenarioReference): Promise<Scenario | null> {
    return Promise.resolve(
      currentReference.scenarioId === reference.scenarioId &&
        currentReference.version === reference.version
        ? scenario
        : null,
    );
  }
}

const engine = new StatelessConversationEngine({
  scenarioRepository: new InMemoryScenarioRepository(),
});

describe('StatelessConversationEngine', () => {
  it('returns the initial node without participant progress', async () => {
    await expect(
      engine.handle({ kind: 'start_scenario', scenario: reference }),
    ).resolves.toEqual({
      actions: [{ id: 'open-order', label: 'My order' }],
      buttonLayout: { columns: 2 },
      messages: [
        {
          attachments: [
            {
              kind: 'photo',
              source: {
                kind: 'external_url',
                url: 'https://assets.example.com/welcome.jpg',
              },
            },
          ],
          text: 'How can I help?',
          textFormat: 'plain',
        },
      ],
      nodeId: 'intro',
      scenario: reference,
    });
  });

  it('resolves a globally unique action to its target node', async () => {
    await expect(
      engine.handle({
        actionId: 'open-order',
        kind: 'select_action',
        scenario: reference,
      }),
    ).resolves.toEqual({
      actions: [],
      messages: [{ speaker: 'Support', text: 'Tell me your order number.' }],
      nodeId: 'order',
      scenario: reference,
    });
  });

  it('does not require a participant or a progress repository', async () => {
    await expect(
      engine.handle({ kind: 'restart_scenario', scenario: reference }),
    ).resolves.toMatchObject({ nodeId: 'intro' });
  });

  it('rejects an action missing from the referenced scenario', async () => {
    await expect(
      engine.handle({
        actionId: 'missing',
        kind: 'select_action',
        scenario: reference,
      }),
    ).rejects.toBeInstanceOf(StatelessActionNotFoundError);
  });

  it('rejects a scenario missing from its repository', async () => {
    await expect(
      engine.handle({
        kind: 'start_scenario',
        scenario: { scenarioId: 'missing', version: 1 },
      }),
    ).rejects.toBeInstanceOf(ScenarioNotFoundError);
  });

  it('rejects a transition whose target node is missing', async () => {
    const invalidScenario = withScenarioChange((current) => {
      const intro = getNodeOrThrow(current, 'intro');

      return {
        ...current,
        nodes: {
          ...current.nodes,
          intro: {
            ...intro,
            transitions: [
              { ...getFirstTransitionOrThrow(intro), targetNodeId: 'missing' },
            ],
          },
        },
      };
    });

    await expect(
      createEngine(invalidScenario).handle({
        actionId: 'open-order',
        kind: 'select_action',
        scenario: reference,
      }),
    ).rejects.toBeInstanceOf(ScenarioNodeNotFoundError);
  });

  it('rejects a duplicated action ID in a programmatically supplied scenario', async () => {
    const invalidScenario = withScenarioChange((current) => {
      const intro = getNodeOrThrow(current, 'intro');
      const transition = getFirstTransitionOrThrow(intro);

      return {
        ...current,
        nodes: {
          ...current.nodes,
          intro: {
            ...intro,
            transitions: [
              transition,
              { ...transition, label: 'My order again' },
            ],
          },
        },
      };
    });

    await expect(
      createEngine(invalidScenario).handle({
        actionId: 'open-order',
        kind: 'select_action',
        scenario: reference,
      }),
    ).rejects.toBeInstanceOf(DuplicateStatelessActionError);
  });

  it('rejects an invalid finish transition in a programmatically supplied scenario', async () => {
    const invalidScenario = withScenarioChange((current) => {
      const intro = getNodeOrThrow(current, 'intro');

      return {
        ...current,
        nodes: {
          ...current.nodes,
          intro: {
            ...intro,
            transitions: [
              { ...getFirstTransitionOrThrow(intro), kind: 'finish' },
            ],
          },
        },
      };
    });

    await expect(
      createEngine(invalidScenario).handle({
        actionId: 'open-order',
        kind: 'select_action',
        scenario: reference,
      }),
    ).rejects.toBeInstanceOf(InvalidFinishTransitionError);
  });
});

function createEngine(currentScenario: Scenario): StatelessConversationEngine {
  return new StatelessConversationEngine({
    scenarioRepository: {
      getById: () => Promise.resolve(currentScenario),
    },
  });
}

function withScenarioChange(
  change: (currentScenario: Scenario) => Scenario,
): Scenario {
  return change(scenario);
}

function getFirstTransitionOrThrow(node: ScenarioNode): Transition {
  const transition = node.transitions[0];

  if (!transition) {
    throw new Error(`Expected node "${node.id}" to have a transition.`);
  }

  return transition;
}

function getNodeOrThrow(scenario: Scenario, nodeId: string): ScenarioNode {
  const node = scenario.nodes[nodeId];

  if (!node) {
    throw new Error(`Expected scenario to have node "${nodeId}".`);
  }

  return node;
}
