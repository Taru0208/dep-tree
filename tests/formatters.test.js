const { describe, it } = require('node:test');
const assert = require('assert');
const { formatTree, formatDot, formatJson } = require('../src/formatters');

const sampleGraph = {
  nodes: [
    { path: 'src/index.js', language: 'javascript', depCount: 2 },
    { path: 'src/a.js', language: 'javascript', depCount: 1 },
    { path: 'src/b.js', language: 'javascript', depCount: 0 },
  ],
  edges: [
    { from: 'src/index.js', to: 'src/a.js', specifier: './a', type: 'local' },
    { from: 'src/index.js', to: 'src/b.js', specifier: './b', type: 'local' },
    { from: 'src/a.js', to: 'src/b.js', specifier: './b', type: 'local' },
  ],
  externals: ['express'],
  builtins: ['fs'],
  unresolved: [],
};

describe('formatTree', () => {
  it('produces text tree output', () => {
    const output = formatTree(sampleGraph, { color: false });
    assert.ok(output.includes('src/index.js'));
    assert.ok(output.includes('src/a.js'));
    assert.ok(output.includes('src/b.js'));
    assert.ok(output.includes('3 files'));
  });

  it('shows external deps in summary', () => {
    const output = formatTree(sampleGraph, { color: false });
    assert.ok(output.includes('External: express'));
  });

  it('shows unresolved in summary', () => {
    const graphWithUnresolved = {
      ...sampleGraph,
      unresolved: [{ from: 'src/index.js', specifier: './missing' }],
    };
    const output = formatTree(graphWithUnresolved, { color: false });
    assert.ok(output.includes('Unresolved'));
    assert.ok(output.includes('./missing'));
  });

  it('handles circular references', () => {
    const circular = {
      nodes: [
        { path: 'a.js', language: 'javascript', depCount: 1 },
        { path: 'b.js', language: 'javascript', depCount: 1 },
      ],
      edges: [
        { from: 'a.js', to: 'b.js', specifier: './b', type: 'local' },
        { from: 'b.js', to: 'a.js', specifier: './a', type: 'local' },
      ],
      externals: [],
      builtins: [],
      unresolved: [],
    };
    const output = formatTree(circular, { color: false });
    assert.ok(output.includes('(circular)'));
  });
});

describe('formatDot', () => {
  it('produces valid DOT output', () => {
    const output = formatDot(sampleGraph);
    assert.ok(output.startsWith('digraph'));
    assert.ok(output.includes('->'));
    assert.ok(output.includes('}'));
  });

  it('includes all nodes', () => {
    const output = formatDot(sampleGraph);
    assert.ok(output.includes('src/index.js'));
    assert.ok(output.includes('src/a.js'));
    assert.ok(output.includes('src/b.js'));
  });
});

describe('formatJson', () => {
  it('produces valid JSON', () => {
    const output = formatJson(sampleGraph);
    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.nodes.length, 3);
    assert.strictEqual(parsed.edges.length, 3);
  });

  it('preserves all data', () => {
    const output = formatJson(sampleGraph);
    const parsed = JSON.parse(output);
    assert.deepStrictEqual(parsed.externals, ['express']);
    assert.deepStrictEqual(parsed.builtins, ['fs']);
  });
});
