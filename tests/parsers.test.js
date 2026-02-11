const { describe, it } = require('node:test');
const assert = require('assert');
const jsParser = require('../src/parsers/javascript');
const pyParser = require('../src/parsers/python');

describe('JavaScript parser', () => {
  it('parses ES module imports', () => {
    const source = `
      import foo from 'foo';
      import { bar } from 'bar';
      import * as baz from './baz';
    `;
    const deps = jsParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['./baz', 'bar', 'foo']);
  });

  it('parses CommonJS require', () => {
    const source = `
      const fs = require('fs');
      const path = require('path');
      const local = require('./lib/util');
    `;
    const deps = jsParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['./lib/util', 'fs', 'path']);
  });

  it('parses dynamic imports', () => {
    const source = `
      const mod = await import('./dynamic');
      import('lazy-module').then(m => m.default);
    `;
    const deps = jsParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['./dynamic', 'lazy-module']);
  });

  it('parses re-exports', () => {
    const source = `
      export { default } from './base';
      export * from './utils';
    `;
    const deps = jsParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['./base', './utils']);
  });

  it('ignores comments', () => {
    const source = `
      // import fake from 'fake';
      /* import also from 'also-fake'; */
      import real from 'real';
    `;
    const deps = jsParser.parse(source);
    assert.deepStrictEqual(deps, ['real']);
  });

  it('ignores imports inside strings', () => {
    const source = `
      const s = "import fake from 'fake'";
      import real from 'real';
    `;
    const deps = jsParser.parse(source);
    assert.deepStrictEqual(deps, ['real']);
  });

  it('handles mixed import styles', () => {
    const source = `
      import defaultExport from 'module-a';
      import { named } from 'module-b';
      const c = require('module-c');
      const d = await import('module-d');
    `;
    const deps = jsParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['module-a', 'module-b', 'module-c', 'module-d']);
  });

  it('classifies dependencies correctly', () => {
    assert.strictEqual(jsParser.classify('./local'), 'local');
    assert.strictEqual(jsParser.classify('../parent'), 'local');
    assert.strictEqual(jsParser.classify('/absolute'), 'local');
    assert.strictEqual(jsParser.classify('fs'), 'builtin');
    assert.strictEqual(jsParser.classify('node:path'), 'builtin');
    assert.strictEqual(jsParser.classify('express'), 'external');
    assert.strictEqual(jsParser.classify('@scope/pkg'), 'external');
  });

  it('handles template literals without breaking', () => {
    const source = `
      const s = \`some template\`;
      import a from 'a';
    `;
    const deps = jsParser.parse(source);
    assert.deepStrictEqual(deps, ['a']);
  });
});

describe('Python parser', () => {
  it('parses import statements', () => {
    const source = `
import os
import sys
import json
    `;
    const deps = pyParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['json', 'os', 'sys']);
  });

  it('parses from...import statements', () => {
    const source = `
from pathlib import Path
from collections import defaultdict
from .local import helper
    `;
    const deps = pyParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['.local', 'collections', 'pathlib']);
  });

  it('parses multi-module import', () => {
    const source = `import os, sys, json`;
    const deps = pyParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['json', 'os', 'sys']);
  });

  it('handles import as aliasing', () => {
    const source = `
import numpy as np
from datetime import datetime as dt
    `;
    const deps = pyParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['datetime', 'numpy']);
  });

  it('ignores comments', () => {
    const source = `
# import fake
import real
    `;
    const deps = pyParser.parse(source);
    assert.deepStrictEqual(deps, ['real']);
  });

  it('ignores docstrings', () => {
    const source = `
"""
import fake_in_docstring
"""
import real
    `;
    const deps = pyParser.parse(source);
    assert.deepStrictEqual(deps, ['real']);
  });

  it('handles relative imports', () => {
    const source = `
from . import sibling
from .. import parent
from ...deep import something
    `;
    const deps = pyParser.parse(source);
    assert.deepStrictEqual(deps.sort(), ['.', '..', '...deep']);
  });

  it('classifies dependencies correctly', () => {
    assert.strictEqual(pyParser.classify('os'), 'builtin');
    assert.strictEqual(pyParser.classify('sys'), 'builtin');
    assert.strictEqual(pyParser.classify('pathlib'), 'builtin');
    assert.strictEqual(pyParser.classify('.local'), 'local');
    assert.strictEqual(pyParser.classify('..parent'), 'local');
    assert.strictEqual(pyParser.classify('numpy'), 'external');
    assert.strictEqual(pyParser.classify('requests'), 'external');
  });
});
