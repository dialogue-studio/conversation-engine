import type { Scenario } from '@dialogue-studio/scenario-schema';
import { describe, expect, it } from 'vitest';

import {
  ActionUnavailableError,
  ConversationEngine,
  InvalidFinishTransitionError,
  ProgressNotFoundError,
  ProgressScenarioMismatchError,
  ScenarioNotFoundError,
} from './index.ts';
import type {
  Clock,
  ParticipantRef,
  ProgressRepository,
  ScenarioProgress,
  ScenarioReference,
  ScenarioRepository,
} from './index.ts';

const participant: ParticipantRef = { id: 'participant-1' };
const scenarioReference: ScenarioReference = {
  scenarioId: 'bank-discovery',
  version: 1,
};

const scenario = {
  id: scenarioReference.scenarioId,
  initialNodeId: 'intro',
  nodes: {
    intro: {
      completesObjectiveIds: [],
      id: 'intro',
      kind: 'message',
      message: 'What would you like to learn?',
      title: 'Introduction',
      transitions: [
        {
          actionId: 'ask-about-bank',
          kind: 'choice',
          label: 'Tell me about the bank',
          targetNodeId: 'bank',
        },
        {
          actionId: 'ask-about-clients',
          kind: 'choice',
          label: 'Who are the clients?',
          targetNodeId: 'clients',
        },
        {
          actionId: 'finish-early',
          kind: 'finish',
          label: 'Finish conversation',
          targetNodeId: 'finish',
        },
      ],
    },
    bank: {
      completesObjectiveIds: ['bank-overview'],
      id: 'bank',
      kind: 'message',
      message: 'The bank supports corporate growth.',
      title: 'About the bank',
      transitions: [
        {
          actionId: 'ask-about-clients-after-bank',
          kind: 'choice',
          label: 'Who are the clients?',
          targetNodeId: 'clients',
        },
        {
          actionId: 'ask-about-data-after-bank',
          kind: 'choice',
          label: 'Which data is used?',
          requiresCompletedObjectiveIds: ['bank-overview', 'clients'],
          targetNodeId: 'data',
        },
      ],
    },
    clients: {
      completesObjectiveIds: ['clients'],
      id: 'clients',
      kind: 'message',
      message: 'The bank works with companies.',
      title: 'Clients',
      transitions: [
        {
          actionId: 'ask-about-data-after-clients',
          kind: 'choice',
          label: 'Which data is used?',
          requiresCompletedObjectiveIds: ['bank-overview', 'clients'],
          targetNodeId: 'data',
        },
      ],
    },
    data: {
      completesObjectiveIds: ['data-sources'],
      id: 'data',
      kind: 'message',
      message: 'The decision uses application and banking-system data.',
      title: 'Data sources',
      transitions: [
        {
          actionId: 'show-data-hint',
          kind: 'hint',
          label: 'Hint',
          targetNodeId: 'data-hint',
        },
        {
          actionId: 'finish-after-data',
          kind: 'finish',
          label: 'Finish conversation',
          targetNodeId: 'finish',
        },
      ],
    },
    'data-hint': {
      completesObjectiveIds: [],
      id: 'data-hint',
      kind: 'message',
      message: 'Ask which sources influence the decision.',
      title: 'Data hint',
      transitions: [
        {
          actionId: 'return-from-data-hint',
          kind: 'navigation',
          label: 'Continue',
          targetNodeId: 'data',
        },
      ],
    },
    finish: {
      completesObjectiveIds: [],
      id: 'finish',
      kind: 'completion',
      message: 'Thank you for the conversation.',
      title: 'Finish',
      transitions: [],
    },
  },
  objectives: [
    { id: 'bank-overview', required: true, title: 'Understand the bank' },
    { id: 'clients', required: true, title: 'Understand the clients' },
    { id: 'data-sources', required: true, title: 'Understand the data' },
  ],
  schemaVersion: 1,
  title: 'Bank discovery',
  version: scenarioReference.version,
} as const satisfies Scenario;

class IncrementingClock implements Clock {
  #calls = 0;

  now(): string {
    this.#calls += 1;
    return `2026-07-23T10:00:0${String(this.#calls)}.000Z`;
  }
}

class InMemoryProgressRepository implements ProgressRepository {
  readonly #progressByKey = new Map<string, ScenarioProgress>();

  get(
    currentParticipant: ParticipantRef,
    currentScenario: ScenarioReference,
  ): Promise<ScenarioProgress | null> {
    return Promise.resolve(
      this.#progressByKey.get(keyFor(currentParticipant, currentScenario)) ??
        null,
    );
  }

  save(progress: ScenarioProgress): Promise<void> {
    this.#progressByKey.set(
      keyFor(progress.participant, progress.scenario),
      progress,
    );
    return Promise.resolve();
  }
}

class InMemoryScenarioRepository implements ScenarioRepository {
  constructor(private readonly scenarios: readonly Scenario[]) {}

  getById(reference: ScenarioReference): Promise<Scenario | null> {
    return Promise.resolve(
      this.scenarios.find(
        ({ id, version }) =>
          id === reference.scenarioId && version === reference.version,
      ) ?? null,
    );
  }
}

function createEngine(
  options: {
    readonly progressRepository?: ProgressRepository;
    readonly scenarios?: readonly Scenario[];
  } = {},
): ConversationEngine {
  return new ConversationEngine({
    clock: new IncrementingClock(),
    progressRepository:
      options.progressRepository ?? new InMemoryProgressRepository(),
    scenarioRepository: new InMemoryScenarioRepository(
      options.scenarios ?? [scenario],
    ),
  });
}

function select(actionId: string) {
  return {
    actionId,
    kind: 'select_action' as const,
    participant,
    scenario: scenarioReference,
  };
}

const start = {
  kind: 'start_scenario' as const,
  participant,
  scenario: scenarioReference,
};

describe('ConversationEngine', () => {
  it('starts a scenario and exposes the initial actions', async () => {
    const output = await createEngine().handle(start);

    expect(output.messages).toEqual([
      { text: 'What would you like to learn?' },
    ]);
    expect(output.actions.map(({ id }) => id)).toEqual([
      'ask-about-bank',
      'ask-about-clients',
      'finish-early',
    ]);
    expect(output.progress).toMatchObject({
      currentNodeId: 'intro',
      status: 'in_progress',
      visitedNodeIds: ['intro'],
    });
  });

  it('gradually unlocks actions after their required objectives are complete', async () => {
    const engine = createEngine();

    await engine.handle(start);
    const afterBank = await engine.handle(select('ask-about-bank'));

    expect(afterBank.progress.completedObjectiveIds).toEqual(['bank-overview']);
    expect(afterBank.actions.map(({ id }) => id)).toEqual([
      'ask-about-clients-after-bank',
    ]);

    await expect(
      engine.handle(select('ask-about-data-after-bank')),
    ).rejects.toThrow(ActionUnavailableError);

    const afterClients = await engine.handle(
      select('ask-about-clients-after-bank'),
    );

    expect(afterClients.actions.map(({ id }) => id)).toEqual([
      'ask-about-data-after-clients',
    ]);
  });

  it('records hint usage and completes the scenario after all required objectives', async () => {
    const engine = createEngine();

    await engine.handle(start);
    await engine.handle(select('ask-about-bank'));
    await engine.handle(select('ask-about-clients-after-bank'));
    await engine.handle(select('ask-about-data-after-clients'));
    const hint = await engine.handle(select('show-data-hint'));

    expect(hint.messages).toEqual([
      { text: 'Ask which sources influence the decision.' },
    ]);
    expect(hint.progress.usedHintActionIds).toEqual(['show-data-hint']);

    await engine.handle(select('return-from-data-hint'));
    const completed = await engine.handle(select('finish-after-data'));

    expect(completed.actions).toEqual([]);
    expect(completed.progress).toMatchObject({
      completedObjectiveIds: ['bank-overview', 'clients', 'data-sources'],
      currentNodeId: 'finish',
      status: 'completed',
    });
    expect(completed.progress.completedAt).toBeDefined();
  });

  it('allows an early finish but records incomplete progress', async () => {
    const engine = createEngine();

    await engine.handle(start);
    const output = await engine.handle(select('finish-early'));

    expect(output.actions).toEqual([]);
    expect(output.progress).toMatchObject({
      completedObjectiveIds: [],
      currentNodeId: 'finish',
      status: 'incomplete',
    });
  });

  it('resumes an in-progress scenario and restarts a completed attempt', async () => {
    const engine = createEngine();

    await engine.handle(start);
    const afterBank = await engine.handle(select('ask-about-bank'));
    const resumed = await engine.handle(start);

    expect(resumed.progress).toEqual(afterBank.progress);

    const restart = await engine.handle({
      kind: 'restart_scenario',
      participant,
      scenario: scenarioReference,
    });

    expect(restart.progress).toMatchObject({
      completedObjectiveIds: [],
      currentNodeId: 'intro',
      status: 'in_progress',
      usedHintActionIds: [],
      visitedNodeIds: ['intro'],
    });
    expect(restart.progress.startedAt).not.toEqual(
      afterBank.progress.startedAt,
    );
  });

  it('rejects actions before a scenario has started and missing scenarios', async () => {
    const engine = createEngine();

    await expect(engine.handle(select('ask-about-bank'))).rejects.toThrow(
      ProgressNotFoundError,
    );
    await expect(
      engine.handle({
        kind: 'start_scenario',
        participant,
        scenario: { scenarioId: 'missing', version: 1 },
      }),
    ).rejects.toThrow(ScenarioNotFoundError);
  });

  it('rejects a finish action that targets a regular message node', async () => {
    const invalidScenario = {
      id: 'invalid-finish',
      initialNodeId: 'intro',
      nodes: {
        intro: {
          completesObjectiveIds: [],
          id: 'intro',
          kind: 'message',
          message: 'Start',
          title: 'Start',
          transitions: [
            {
              actionId: 'invalid-finish-action',
              kind: 'finish',
              label: 'Finish',
              targetNodeId: 'not-finished',
            },
          ],
        },
        'not-finished': {
          completesObjectiveIds: [],
          id: 'not-finished',
          kind: 'message',
          message: 'This is not a completion node.',
          title: 'Not finished',
          transitions: [],
        },
      },
      objectives: [],
      schemaVersion: 1,
      title: 'Invalid finish',
      version: 1,
    } as const satisfies Scenario;
    const invalidReference: ScenarioReference = {
      scenarioId: invalidScenario.id,
      version: invalidScenario.version,
    };
    const engine = createEngine({ scenarios: [invalidScenario] });

    await engine.handle({
      kind: 'start_scenario',
      participant,
      scenario: invalidReference,
    });

    await expect(
      engine.handle({
        actionId: 'invalid-finish-action',
        kind: 'select_action',
        participant,
        scenario: invalidReference,
      }),
    ).rejects.toThrow(InvalidFinishTransitionError);
  });

  it('rejects progress returned for a different scenario version', async () => {
    const newerReference: ScenarioReference = {
      scenarioId: scenarioReference.scenarioId,
      version: 2,
    };
    const staleProgress: ScenarioProgress = {
      completedObjectiveIds: [],
      currentNodeId: 'intro',
      participant,
      scenario: scenarioReference,
      startedAt: '2026-07-23T10:00:00.000Z',
      status: 'in_progress',
      updatedAt: '2026-07-23T10:00:00.000Z',
      usedHintActionIds: [],
      visitedNodeIds: ['intro'],
    };
    const engine = createEngine({
      progressRepository: {
        get: () => Promise.resolve(staleProgress),
        save: () => Promise.resolve(),
      },
      scenarios: [{ ...scenario, version: newerReference.version }],
    });

    await expect(
      engine.handle({
        actionId: 'ask-about-bank',
        kind: 'select_action',
        participant,
        scenario: newerReference,
      }),
    ).rejects.toThrow(ProgressScenarioMismatchError);
  });
});

function keyFor(
  currentParticipant: ParticipantRef,
  currentScenario: ScenarioReference,
): string {
  return `${currentParticipant.id}:${currentScenario.scenarioId}:${String(currentScenario.version)}`;
}
