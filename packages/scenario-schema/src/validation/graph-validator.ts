import type { Scenario } from '../index.js';

import type { ValidationIssues } from './issues.js';
import { reportGraphViolation } from './issues.js';
import { validateReachability } from './reachability-validator.js';

export function validateGraph(
  scenario: Scenario,
  issues: ValidationIssues,
): void {
  const objectiveIds = validateObjectives(scenario, issues);
  validateInitialNode(scenario, issues);

  const completedObjectiveIds = new Set<string>();
  const actionIds = new Set<string>();
  let completionNodeCount = 0;

  for (const [nodeKey, node] of Object.entries(scenario.nodes)) {
    const nodePath = ['nodes', nodeKey] as const;

    validateNodeIdentity(nodeKey, node.id, nodePath, issues);
    completionNodeCount += validateNodeTerminalState(node, nodePath, issues);
    validateCompletedObjectives(
      node.completesObjectiveIds,
      objectiveIds,
      completedObjectiveIds,
      nodePath,
      issues,
    );
    validateTransitions(
      scenario,
      node,
      actionIds,
      objectiveIds,
      nodePath,
      issues,
    );
  }

  validateCompletionNodes(completionNodeCount, issues);
  validateRequiredObjectives(scenario, completedObjectiveIds, issues);
  validateReachability(scenario, issues);
}

function validateObjectives(
  scenario: Scenario,
  issues: ValidationIssues,
): ReadonlySet<string> {
  const objectiveIds = new Set<string>();

  for (const [index, objective] of scenario.objectives.entries()) {
    if (objectiveIds.has(objective.id)) {
      reportGraphViolation(
        issues,
        ['objectives', index, 'id'],
        'duplicate_objective_id',
        `Objective ID "${objective.id}" is duplicated.`,
      );
    }

    objectiveIds.add(objective.id);
  }

  return objectiveIds;
}

function validateInitialNode(
  scenario: Scenario,
  issues: ValidationIssues,
): void {
  if (!scenario.nodes[scenario.initialNodeId]) {
    reportGraphViolation(
      issues,
      ['initialNodeId'],
      'missing_initial_node',
      `Initial node "${scenario.initialNodeId}" does not exist.`,
    );
  }
}

function validateNodeIdentity(
  nodeKey: string,
  nodeId: string,
  nodePath: readonly string[],
  issues: ValidationIssues,
): void {
  if (nodeId !== nodeKey) {
    reportGraphViolation(
      issues,
      [...nodePath, 'id'],
      'node_key_mismatch',
      `Node key "${nodeKey}" must equal node ID "${nodeId}".`,
    );
  }
}

function validateNodeTerminalState(
  node: Scenario['nodes'][string],
  nodePath: readonly string[],
  issues: ValidationIssues,
): number {
  if (node.kind === 'completion') {
    if (node.transitions.length > 0) {
      reportGraphViolation(
        issues,
        [...nodePath, 'transitions'],
        'completion_has_transitions',
        'A completion node cannot have outgoing transitions.',
      );
    }

    return 1;
  }

  if (node.transitions.length === 0) {
    reportGraphViolation(
      issues,
      [...nodePath, 'transitions'],
      'message_without_transitions',
      'A message node without outgoing transitions must be a completion node.',
    );
  }

  return 0;
}

function validateCompletedObjectives(
  nodeObjectiveIds: readonly string[],
  objectiveIds: ReadonlySet<string>,
  completedObjectiveIds: Set<string>,
  nodePath: readonly string[],
  issues: ValidationIssues,
): void {
  for (const objectiveId of nodeObjectiveIds) {
    completedObjectiveIds.add(objectiveId);

    if (!objectiveIds.has(objectiveId)) {
      reportGraphViolation(
        issues,
        [...nodePath, 'completesObjectiveIds'],
        'unknown_objective',
        `Node completes unknown objective "${objectiveId}".`,
      );
    }
  }
}

function validateTransitions(
  scenario: Scenario,
  node: Scenario['nodes'][string],
  actionIds: Set<string>,
  objectiveIds: ReadonlySet<string>,
  nodePath: readonly string[],
  issues: ValidationIssues,
): void {
  for (const [index, transition] of node.transitions.entries()) {
    const transitionPath = [...nodePath, 'transitions', index] as const;
    const targetNode = scenario.nodes[transition.targetNodeId];

    if (actionIds.has(transition.actionId)) {
      reportGraphViolation(
        issues,
        [...transitionPath, 'actionId'],
        'duplicate_action_id',
        `Action ID "${transition.actionId}" is duplicated.`,
      );
    }

    actionIds.add(transition.actionId);
    validateTransitionTarget(transition, targetNode, transitionPath, issues);
    validateTransitionObjectives(
      transition.requiresCompletedObjectiveIds ?? [],
      objectiveIds,
      transitionPath,
      issues,
    );
  }
}

function validateTransitionTarget(
  transition: Scenario['nodes'][string]['transitions'][number],
  targetNode: Scenario['nodes'][string] | undefined,
  transitionPath: readonly (number | string)[],
  issues: ValidationIssues,
): void {
  if (!targetNode) {
    reportGraphViolation(
      issues,
      [...transitionPath, 'targetNodeId'],
      'missing_transition_target',
      `Transition targets missing node "${transition.targetNodeId}".`,
    );
    return;
  }

  if (transition.kind === 'finish' && targetNode.kind !== 'completion') {
    reportGraphViolation(
      issues,
      [...transitionPath, 'targetNodeId'],
      'finish_target_not_completion',
      'A finish transition must target a completion node.',
    );
  }

  if (transition.kind !== 'finish' && targetNode.kind === 'completion') {
    reportGraphViolation(
      issues,
      [...transitionPath, 'kind'],
      'completion_target_not_finish',
      'Only a finish transition can target a completion node.',
    );
  }

  if (transition.kind === 'hint' && targetNode.kind !== 'message') {
    reportGraphViolation(
      issues,
      [...transitionPath, 'targetNodeId'],
      'hint_target_not_message',
      'A hint transition must target a message node.',
    );
  }
}

function validateTransitionObjectives(
  requiredObjectiveIds: readonly string[],
  objectiveIds: ReadonlySet<string>,
  transitionPath: readonly (number | string)[],
  issues: ValidationIssues,
): void {
  for (const objectiveId of requiredObjectiveIds) {
    if (!objectiveIds.has(objectiveId)) {
      reportGraphViolation(
        issues,
        [...transitionPath, 'requiresCompletedObjectiveIds'],
        'unknown_objective',
        `Transition requires unknown objective "${objectiveId}".`,
      );
    }
  }
}

function validateCompletionNodes(
  completionNodeCount: number,
  issues: ValidationIssues,
): void {
  if (completionNodeCount === 0) {
    reportGraphViolation(
      issues,
      ['nodes'],
      'missing_completion_node',
      'A scenario must contain at least one completion node.',
    );
  }
}

function validateRequiredObjectives(
  scenario: Scenario,
  completedObjectiveIds: ReadonlySet<string>,
  issues: ValidationIssues,
): void {
  for (const objective of scenario.objectives) {
    if (objective.required && !completedObjectiveIds.has(objective.id)) {
      reportGraphViolation(
        issues,
        ['objectives'],
        'uncompletable_required_objective',
        `Required objective "${objective.id}" is not completed by any node.`,
      );
    }
  }
}
