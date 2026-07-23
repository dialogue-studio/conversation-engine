import { describe, expect, it } from 'vitest';

import { getInitialNode } from './index.ts';

describe('getInitialNode', () => {
  it('returns the configured initial node', () => {
    const initialNode = {
      completesObjectiveIds: [],
      id: 'intro',
      kind: 'message',
      message: 'Hello',
      title: 'Introduction',
      transitions: [],
    } as const;

    expect(
      getInitialNode({
        id: 'example',
        initialNodeId: 'intro',
        nodes: { intro: initialNode },
        objectives: [],
        schemaVersion: 1,
        title: 'Example',
        version: 1,
      }),
    ).toBe(initialNode);
  });

  it('throws when the initial node is absent', () => {
    expect(() =>
      getInitialNode({
        id: 'broken-example',
        initialNodeId: 'missing',
        nodes: {},
        objectives: [],
        schemaVersion: 1,
        title: 'Broken example',
        version: 1,
      }),
    ).toThrow('Scenario "broken-example" is missing node "missing".');
  });
});
