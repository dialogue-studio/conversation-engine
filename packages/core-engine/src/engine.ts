import type {
  Scenario,
  ScenarioNode,
  Transition,
} from '@conversation-engine/scenario-schema';

import type {
  EngineAction,
  EngineInput,
  EngineMessage,
  EngineOutput,
  ParticipantRef,
  ProgressRepository,
  ScenarioProgress,
  ScenarioReference,
  ScenarioRepository,
} from './index.js';

export interface Clock {
  now(): string;
}

export interface ConversationEngineOptions {
  readonly clock: Clock;
  readonly progressRepository: ProgressRepository;
  readonly scenarioRepository: ScenarioRepository;
}

export class ScenarioNotFoundError extends Error {
  constructor(reference: ScenarioReference) {
    super(
      `Scenario "${reference.scenarioId}" version ${String(reference.version)} was not found.`,
    );
    this.name = 'ScenarioNotFoundError';
  }
}

export class ProgressNotFoundError extends Error {
  constructor(participant: ParticipantRef, scenario: ScenarioReference) {
    super(
      `Participant "${participant.id}" has not started scenario "${scenario.scenarioId}" version ${String(scenario.version)}.`,
    );
    this.name = 'ProgressNotFoundError';
  }
}

export class ActionUnavailableError extends Error {
  constructor(actionId: string, nodeId: string) {
    super(`Action "${actionId}" is unavailable from node "${nodeId}".`);
    this.name = 'ActionUnavailableError';
  }
}

export class InvalidFinishTransitionError extends Error {
  constructor(actionId: string, targetNodeId: string) {
    super(
      `Finish action "${actionId}" must target a completion node, but targeted "${targetNodeId}".`,
    );
    this.name = 'InvalidFinishTransitionError';
  }
}

export class ProgressScenarioMismatchError extends Error {
  constructor(progress: ScenarioReference, input: ScenarioReference) {
    super(
      `Progress belongs to scenario "${progress.scenarioId}" version ${String(progress.version)}, but the input references "${input.scenarioId}" version ${String(input.version)}.`,
    );
    this.name = 'ProgressScenarioMismatchError';
  }
}

export class ScenarioNodeNotFoundError extends Error {
  constructor(scenarioId: string, nodeId: string) {
    super(`Scenario "${scenarioId}" is missing node "${nodeId}".`);
    this.name = 'ScenarioNodeNotFoundError';
  }
}

export class ConversationEngine {
  readonly #clock: Clock;
  readonly #progressRepository: ProgressRepository;
  readonly #scenarioRepository: ScenarioRepository;

  constructor(options: ConversationEngineOptions) {
    this.#clock = options.clock;
    this.#progressRepository = options.progressRepository;
    this.#scenarioRepository = options.scenarioRepository;
  }

  async handle(input: EngineInput): Promise<EngineOutput> {
    const scenario = await this.#getScenario(input.scenario);

    switch (input.kind) {
      case 'start_scenario':
        return this.#start(scenario, input.participant, input.scenario);
      case 'restart_scenario':
        return this.#restart(scenario, input.participant, input.scenario);
      case 'select_action':
        return this.#selectAction(scenario, input);
    }
  }

  async #getScenario(reference: ScenarioReference): Promise<Scenario> {
    const scenario = await this.#scenarioRepository.getById(reference);

    if (!scenario) {
      throw new ScenarioNotFoundError(reference);
    }

    return scenario;
  }

  async #restart(
    scenario: Scenario,
    participant: ParticipantRef,
    reference: ScenarioReference,
  ): Promise<EngineOutput> {
    const progress = this.#createInitialProgress(
      scenario,
      participant,
      reference,
    );
    await this.#progressRepository.save(progress);

    return this.#toOutput(scenario, progress);
  }

  async #selectAction(
    scenario: Scenario,
    input: Extract<EngineInput, { kind: 'select_action' }>,
  ): Promise<EngineOutput> {
    const currentProgress = await this.#progressRepository.get(
      input.participant,
      input.scenario,
    );

    if (!currentProgress) {
      throw new ProgressNotFoundError(input.participant, input.scenario);
    }

    if (!sameScenarioReference(currentProgress.scenario, input.scenario)) {
      throw new ProgressScenarioMismatchError(
        currentProgress.scenario,
        input.scenario,
      );
    }

    if (currentProgress.status !== 'in_progress') {
      throw new ActionUnavailableError(
        input.actionId,
        currentProgress.currentNodeId,
      );
    }

    const currentNode = this.#getNode(scenario, currentProgress.currentNodeId);
    const transition = currentNode.transitions.find(
      ({ actionId }) => actionId === input.actionId,
    );

    if (
      !transition ||
      !this.#isTransitionAvailable(transition, currentProgress)
    ) {
      throw new ActionUnavailableError(input.actionId, currentNode.id);
    }

    const nextNode = this.#getNode(scenario, transition.targetNodeId);

    if (transition.kind === 'finish' && nextNode.kind !== 'completion') {
      throw new InvalidFinishTransitionError(transition.actionId, nextNode.id);
    }

    const now = this.#clock.now();
    const completedObjectiveIds = unique([
      ...currentProgress.completedObjectiveIds,
      ...nextNode.completesObjectiveIds,
    ]);
    const status = this.#getProgressStatus(
      scenario,
      nextNode,
      completedObjectiveIds,
    );
    const progress: ScenarioProgress = {
      ...currentProgress,
      ...(status === 'in_progress' ? {} : { completedAt: now }),
      completedObjectiveIds,
      currentNodeId: nextNode.id,
      status,
      updatedAt: now,
      usedHintActionIds:
        transition.kind === 'hint'
          ? unique([...currentProgress.usedHintActionIds, transition.actionId])
          : currentProgress.usedHintActionIds,
      visitedNodeIds: unique([...currentProgress.visitedNodeIds, nextNode.id]),
    };

    await this.#progressRepository.save(progress);

    return this.#toOutput(scenario, progress);
  }

  async #start(
    scenario: Scenario,
    participant: ParticipantRef,
    reference: ScenarioReference,
  ): Promise<EngineOutput> {
    const currentProgress = await this.#progressRepository.get(
      participant,
      reference,
    );

    if (currentProgress?.status === 'in_progress') {
      return this.#toOutput(scenario, currentProgress);
    }

    return this.#restart(scenario, participant, reference);
  }

  #createInitialProgress(
    scenario: Scenario,
    participant: ParticipantRef,
    reference: ScenarioReference,
  ): ScenarioProgress {
    const initialNode = this.#getNode(scenario, scenario.initialNodeId);
    const now = this.#clock.now();
    const completedObjectiveIds = unique(initialNode.completesObjectiveIds);
    const status = this.#getProgressStatus(
      scenario,
      initialNode,
      completedObjectiveIds,
    );

    return {
      ...(status === 'in_progress' ? {} : { completedAt: now }),
      completedObjectiveIds,
      currentNodeId: initialNode.id,
      participant,
      scenario: reference,
      startedAt: now,
      status,
      updatedAt: now,
      usedHintActionIds: [],
      visitedNodeIds: [initialNode.id],
    };
  }

  #getNode(scenario: Scenario, nodeId: string): ScenarioNode {
    const node = scenario.nodes[nodeId];

    if (!node) {
      throw new ScenarioNodeNotFoundError(scenario.id, nodeId);
    }

    return node;
  }

  #getProgressStatus(
    scenario: Scenario,
    node: ScenarioNode,
    completedObjectiveIds: readonly string[],
  ): ScenarioProgress['status'] {
    if (node.kind !== 'completion') {
      return 'in_progress';
    }

    const requiredObjectiveIds = scenario.objectives
      .filter(({ required }) => required)
      .map(({ id }) => id);

    return requiredObjectiveIds.every((id) =>
      completedObjectiveIds.includes(id),
    )
      ? 'completed'
      : 'incomplete';
  }

  #isTransitionAvailable(
    transition: Transition,
    progress: ScenarioProgress,
  ): boolean {
    return (
      transition.requiresCompletedObjectiveIds?.every((id) =>
        progress.completedObjectiveIds.includes(id),
      ) ?? true
    );
  }

  #toOutput(scenario: Scenario, progress: ScenarioProgress): EngineOutput {
    const node = this.#getNode(scenario, progress.currentNodeId);
    const messages: readonly EngineMessage[] = [
      {
        ...(node.speaker ? { speaker: node.speaker } : {}),
        text: node.message,
      },
    ];
    const actions: readonly EngineAction[] =
      progress.status === 'in_progress'
        ? node.transitions
            .filter((transition) =>
              this.#isTransitionAvailable(transition, progress),
            )
            .map(({ actionId, label }) => ({ id: actionId, label }))
        : [];

    return { actions, messages, progress };
  }
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function sameScenarioReference(
  first: ScenarioReference,
  second: ScenarioReference,
): boolean {
  return (
    first.scenarioId === second.scenarioId && first.version === second.version
  );
}
