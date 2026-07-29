import type {
  Scenario,
  ScenarioNode,
  Transition,
} from '@dialogue-studio/scenario-schema';

import type {
  EngineAction,
  EngineMessage,
  ScenarioReference,
  ScenarioRepository,
} from './index.js';
import { InvalidFinishTransitionError } from './engine.js';
import { getNode, getScenario } from './scenario-resolution.js';

/** Input for a conversation that deliberately retains no participant state. */
export interface StatelessStartScenarioInput {
  readonly kind: 'start_scenario' | 'restart_scenario';
  readonly scenario: ScenarioReference;
}

/** A platform action ID is globally unique within its published scenario. */
export interface StatelessSelectActionInput {
  readonly actionId: string;
  readonly kind: 'select_action';
  readonly scenario: ScenarioReference;
}

export type StatelessEngineInput =
  StatelessSelectActionInput | StatelessStartScenarioInput;

/**
 * The platform-independent reply for a stateless conversation step.
 *
 * Buttons are the user-facing navigation mechanism. This engine does not
 * retain progress or enforce objective-based availability: platforms render
 * only the actions attached to the node they just displayed.
 */
export interface StatelessEngineOutput {
  readonly actions: readonly EngineAction[];
  readonly buttonLayout?: ScenarioNode['buttonLayout'];
  readonly messages: readonly EngineMessage[];
  readonly nodeId: string;
  readonly scenario: ScenarioReference;
}

export interface StatelessConversationEngineOptions {
  readonly scenarioRepository: ScenarioRepository;
}

export class StatelessActionNotFoundError extends Error {
  constructor(actionId: string, reference: ScenarioReference) {
    super(
      `Action "${actionId}" was not found in scenario "${reference.scenarioId}" version ${String(reference.version)}.`,
    );
    this.name = 'StatelessActionNotFoundError';
  }
}

export class DuplicateStatelessActionError extends Error {
  constructor(actionId: string, reference: ScenarioReference) {
    super(
      `Action "${actionId}" is duplicated in scenario "${reference.scenarioId}" version ${String(reference.version)}.`,
    );
    this.name = 'DuplicateStatelessActionError';
  }
}

/**
 * Resolves a published scenario graph without persisting a learner's progress.
 *
 * This is the MVP engine for button-led support and training bots. It accepts
 * an action only by its scenario-wide stable ID, then returns the action's
 * target node. Objective locks require persisted progress and therefore belong
 * to the separate stateful ConversationEngine.
 */
export class StatelessConversationEngine {
  readonly #scenarioRepository: ScenarioRepository;

  constructor(options: StatelessConversationEngineOptions) {
    this.#scenarioRepository = options.scenarioRepository;
  }

  async handle(input: StatelessEngineInput): Promise<StatelessEngineOutput> {
    const scenario = await getScenario(
      this.#scenarioRepository,
      input.scenario,
    );

    if (input.kind === 'select_action') {
      const transition = this.#findTransition(
        scenario,
        input.actionId,
        input.scenario,
      );

      if (!transition) {
        throw new StatelessActionNotFoundError(input.actionId, input.scenario);
      }

      const targetNode = getNode(scenario, transition.targetNodeId);

      if (transition.kind === 'finish' && targetNode.kind !== 'completion') {
        throw new InvalidFinishTransitionError(
          transition.actionId,
          targetNode.id,
        );
      }

      return this.#toOutput(targetNode, input.scenario);
    }

    return this.#toOutput(
      getNode(scenario, scenario.initialNodeId),
      input.scenario,
    );
  }

  #findTransition(
    scenario: Scenario,
    actionId: string,
    reference: ScenarioReference,
  ): Transition | null {
    let match: Transition | null = null;

    for (const node of Object.values(scenario.nodes)) {
      for (const transition of node.transitions) {
        if (transition.actionId !== actionId) {
          continue;
        }

        if (match) {
          throw new DuplicateStatelessActionError(actionId, reference);
        }

        match = transition;
      }
    }

    return match;
  }

  #toOutput(
    node: ScenarioNode,
    reference: ScenarioReference,
  ): StatelessEngineOutput {
    return {
      actions: node.transitions.map(({ actionId, label }) => ({
        id: actionId,
        label,
      })),
      ...(node.buttonLayout ? { buttonLayout: node.buttonLayout } : {}),
      messages: [
        {
          ...(node.speaker ? { speaker: node.speaker } : {}),
          text: node.message,
        },
      ],
      nodeId: node.id,
      scenario: reference,
    };
  }
}
