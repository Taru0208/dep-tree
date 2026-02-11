const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildGraph, discoverEntries, resolveLocal } = require('../src/graph');

let tmpDir;

function setup(files) {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-tree-test-'));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(tmpDir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return tmpDir;
}

function cleanup() {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
}

describe('resolveLocal', () => {
  afterEach(cleanup);

  it('resolves exact path', () => {
    const dir = setup({ 'src/a.js': '', 'src/b.js': '' });
    const result = resolveLocal('./b', path.join(dir, 'src/a.js'), dir);
    assert.strictEqual(result, 'src/b.js');
  });

  it('resolves with extension', () => {
    const dir = setup({ 'src/a.js': '', 'src/b.js': '' });
    const result = resolveLocal('./b', path.join(dir, 'src/a.js'), dir);
    assert.strictEqual(result, 'src/b.js');
  });

  it('resolves index file in directory', () => {
    const dir = setup({ 'src/a.js': '', 'src/lib/index.js': '' });
    const result = resolveLocal('./lib', path.join(dir, 'src/a.js'), dir);
    assert.strictEqual(result, 'src/lib/index.js');
  });

  it('returns null for unresolvable', () => {
    const dir = setup({ 'src/a.js': '' });
    const result = resolveLocal('./nonexistent', path.join(dir, 'src/a.js'), dir);
    assert.strictEqual(result, null);
  });
});

describe('buildGraph', () => {
  afterEach(cleanup);

  it('builds simple graph', () => {
    const dir = setup({
      'index.js': "const a = require('./a');\nconst b = require('./b');",
      'a.js': "const b = require('./b');",
      'b.js': "// leaf",
    });

    const graph = buildGraph(['index.js'], { rootDir: dir });

    assert.strictEqual(graph.nodes.length, 3);
    assert.strictEqual(graph.edges.length, 3);
    assert.deepStrictEqual(graph.externals, []);
  });

  it('detects external dependencies', () => {
    const dir = setup({
      'index.js': "const express = require('express');\nconst fs = require('fs');",
    });

    const graph = buildGraph(['index.js'], { rootDir: dir });

    assert.deepStrictEqual(graph.externals, ['express']);
    assert.deepStrictEqual(graph.builtins, ['fs']);
  });

  it('includes externals when requested', () => {
    const dir = setup({
      'index.js': "const express = require('express');",
    });

    const graph = buildGraph(['index.js'], { rootDir: dir, includeExternal: true });

    assert.strictEqual(graph.edges.length, 1);
    assert.strictEqual(graph.edges[0].type, 'external');
  });

  it('handles circular dependencies', () => {
    const dir = setup({
      'a.js': "const b = require('./b');",
      'b.js': "const a = require('./a');",
    });

    const graph = buildGraph(['a.js'], { rootDir: dir });

    assert.strictEqual(graph.nodes.length, 2);
    assert.strictEqual(graph.edges.length, 2);
  });

  it('respects maxDepth', () => {
    const dir = setup({
      'a.js': "const b = require('./b');",
      'b.js': "const c = require('./c');",
      'c.js': "// deep",
    });

    const graph = buildGraph(['a.js'], { rootDir: dir, maxDepth: 1 });

    // a -> b is traversed (depth 0), b -> c edge exists but c not traversed
    assert.strictEqual(graph.nodes.length, 2); // a, b
    assert.strictEqual(graph.edges.length, 2); // a->b, b->c
  });

  it('tracks unresolved imports', () => {
    const dir = setup({
      'index.js': "const x = require('./missing');",
    });

    const graph = buildGraph(['index.js'], { rootDir: dir });

    assert.strictEqual(graph.unresolved.length, 1);
    assert.strictEqual(graph.unresolved[0].specifier, './missing');
  });

  it('works with Python files', () => {
    const dir = setup({
      'main.py': "from .utils import helper\nimport os",
      'utils.py': "import json",
    });

    const graph = buildGraph(['main.py'], { rootDir: dir });

    assert.ok(graph.nodes.length >= 1);
    assert.ok(graph.builtins.includes('os'));
  });
});

describe('discoverEntries', () => {
  afterEach(cleanup);

  it('finds package.json main', () => {
    const dir = setup({
      'package.json': JSON.stringify({ main: 'src/index.js' }),
      'src/index.js': '',
    });

    const entries = discoverEntries(dir);
    assert.ok(entries.includes('src/index.js'));
  });

  it('finds package.json bin', () => {
    const dir = setup({
      'package.json': JSON.stringify({ bin: { 'my-tool': 'src/cli.js' } }),
      'src/cli.js': '',
    });

    const entries = discoverEntries(dir);
    assert.ok(entries.includes('src/cli.js'));
  });

  it('finds common entry files', () => {
    const dir = setup({
      'index.js': '',
    });

    const entries = discoverEntries(dir);
    assert.ok(entries.includes('index.js'));
  });
});
