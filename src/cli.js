#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');
const { buildGraph, discoverEntries } = require('./graph');
const { formatTree, formatDot, formatJson } = require('./formatters');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    format: {
      type: 'string',
      short: 'f',
      default: 'tree',
    },
    entry: {
      type: 'string',
      short: 'e',
      multiple: true,
      default: [],
    },
    external: {
      type: 'boolean',
      default: false,
    },
    builtin: {
      type: 'boolean',
      default: false,
    },
    depth: {
      type: 'string',
      short: 'd',
      default: 'Infinity',
    },
    'no-color': {
      type: 'boolean',
      default: false,
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false,
    },
    version: {
      type: 'boolean',
      short: 'v',
      default: false,
    },
  },
});

if (values.help) {
  console.log(`dep-tree — trace import/require dependencies

Usage:
  dep-tree [dir]              Analyze current or given directory
  dep-tree -e src/index.js    Start from specific entry point(s)

Options:
  -f, --format <fmt>    Output format: tree, dot, json (default: tree)
  -e, --entry <file>    Entry point(s) (repeatable; auto-detected if omitted)
  -d, --depth <n>       Max traversal depth (default: unlimited)
  --external            Include external (npm/pip) dependencies
  --builtin             Include builtin (node/python stdlib) dependencies
  --no-color            Disable color output
  -h, --help            Show this help
  -v, --version         Show version`);
  process.exit(0);
}

if (values.version) {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  console.log(pkg.version);
  process.exit(0);
}

const rootDir = path.resolve(positionals[0] || '.');
const maxDepth = values.depth === 'Infinity' ? Infinity : parseInt(values.depth, 10);

// Determine entry points
let entries = values.entry;
if (entries.length === 0) {
  entries = discoverEntries(rootDir);
}

if (entries.length === 0) {
  console.error('No entry points found. Use -e to specify one.');
  process.exit(1);
}

// Build graph
const graph = buildGraph(entries, {
  rootDir,
  includeExternal: values.external,
  includeBuiltin: values.builtin,
  maxDepth,
});

// Format output
const noColor = values['no-color'] || !process.stdout.isTTY;
let output;
switch (values.format) {
  case 'dot':
    output = formatDot(graph, { title: path.basename(rootDir) });
    break;
  case 'json':
    output = formatJson(graph);
    break;
  case 'tree':
  default:
    output = formatTree(graph, { color: !noColor });
    break;
}

console.log(output);
