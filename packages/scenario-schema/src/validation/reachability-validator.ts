import type { Scenario } from '../index.js';

import type { ValidationIssues } from './issues.js';
import { reportGraphViolation } from './issues.js';

export function validateReachability(
  scenario: Scenario,
  issues: ValidationIssues,
): void {
  const reachableNodeIds = collectReachableNodeIds(scenario);

  validateReachableNodes(scenario, reachableNodeIds, issues);
  validateReachableCompletionNode(scenario, reachableNodeIds, issues);
}

function collectReachableNodeIds(scenario: Scenario): ReadonlySet<string> {
  const reachableNodeIds = new Set<string>();
  const pendingNodeIds = [scenario.initialNodeId];

  while (pendingNodeIds.length > 0) {
    const nodeId = pendingNodeIds.pop();

    if (!nodeId || reachableNodeIds.has(nodeId)) {
      continue;
    }

    const node = scenario.nodes[nodeId];

    if (!node) {
      continue;
    }

    reachableNodeIds.add(nodeId);

    for (const { targetNodeId } of node.transitions) {
      pendingNodeIds.push(targetNodeId);
    }
  }

  return reachableNodeIds;
}

function validateReachableNodes(
  scenario: Scenario,
  reachableNodeIds: ReadonlySet<string>,
  issues: ValidationIssues,
): void {
  for (const nodeId of Object.keys(scenario.nodes)) {
    if (!reachableNodeIds.has(nodeId)) {
      reportGraphViolation(
        issues,
        ['nodes', nodeId],
        'unreachable_node',
        `Node "${nodeId}" cannot be reached from the initial node.`,
      );
    }
  }
}

function validateReachableCompletionNode(
  scenario: Scenario,
  reachableNodeIds: ReadonlySet<string>,
  issues: ValidationIssues,
): void {
  const completionIsReachable = [...reachableNodeIds].some(
    (nodeId) => scenario.nodes[nodeId]?.kind === 'completion',
  );

  if (!completionIsReachable) {
    reportGraphViolation(
      issues,
      ['initialNodeId'],
      'completion_unreachable',
      'No completion node can be reached from the initial node.',
    );
  }
}
