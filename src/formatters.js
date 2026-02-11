const path = require('path');

/**
 * Format graph as a text tree.
 */
function formatTree(graph, options = {}) {
  const { color = true } = options;
  const lines = [];

  // Build adjacency list
  const adj = new Map();
  for (const edge of graph.edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from).push(edge);
  }

  // Find root nodes (nodes with no incoming local edges)
  const targets = new Set(graph.edges.filter(e => e.type === 'local').map(e => e.to));
  const roots = graph.nodes
    .map(n => n.path)
    .filter(p => !targets.has(p));

  if (roots.length === 0 && graph.nodes.length > 0) {
    // Circular — pick first node
    roots.push(graph.nodes[0].path);
  }

  const visited = new Set();

  function render(nodePath, prefix, isLast, isRoot) {
    const connector = isRoot ? '' : (isLast ? '└── ' : '├── ');
    const name = color ? colorize(nodePath) : nodePath;
    lines.push(prefix + connector + name);

    if (visited.has(nodePath)) {
      if (adj.has(nodePath)) {
        const nextPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
        lines.push(nextPrefix + (color ? '\x1b[2m(circular)\x1b[0m' : '(circular)'));
      }
      return;
    }
    visited.add(nodePath);

    const children = (adj.get(nodePath) || []).filter(e => e.type === 'local');
    const nextPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');

    children.forEach((edge, i) => {
      const last = i === children.length - 1;
      render(edge.to, nextPrefix, last, false);
    });
  }

  roots.forEach((root, i) => {
    if (i > 0) lines.push('');
    render(root, '', i === roots.length - 1, true);
  });

  // Summary
  lines.push('');
  lines.push(`${graph.nodes.length} files, ${graph.edges.filter(e => e.type === 'local').length} local deps`);

  if (graph.externals.length > 0) {
    lines.push(`External: ${graph.externals.join(', ')}`);
  }

  if (graph.unresolved.length > 0) {
    const label = color ? '\x1b[33mUnresolved\x1b[0m' : 'Unresolved';
    lines.push(`${label}: ${graph.unresolved.map(u => u.specifier).join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Colorize a file path based on extension.
 */
function colorize(filePath) {
  const ext = path.extname(filePath);
  const colors = {
    '.js': '\x1b[33m',   // yellow
    '.ts': '\x1b[36m',   // cyan
    '.tsx': '\x1b[36m',
    '.jsx': '\x1b[33m',
    '.py': '\x1b[32m',   // green
    '.mjs': '\x1b[33m',
    '.cjs': '\x1b[33m',
  };
  const c = colors[ext] || '';
  return c ? `${c}${filePath}\x1b[0m` : filePath;
}

/**
 * Format graph as DOT (Graphviz) format.
 */
function formatDot(graph, options = {}) {
  const { title = 'Dependencies' } = options;
  const lines = [
    `digraph "${title}" {`,
    '  rankdir=LR;',
    '  node [shape=box, style=rounded, fontname="Helvetica"];',
    '',
  ];

  // Nodes
  for (const node of graph.nodes) {
    const id = dotId(node.path);
    const label = node.path;
    const color = node.language === 'python' ? '#3776ab' : '#f7df1e';
    lines.push(`  ${id} [label="${label}", color="${color}"];`);
  }

  // External nodes
  const extNodes = new Set();
  for (const edge of graph.edges) {
    if (edge.type === 'external' || edge.type === 'builtin') {
      if (!extNodes.has(edge.to)) {
        extNodes.add(edge.to);
        const id = dotId(edge.to);
        lines.push(`  ${id} [label="${edge.to}", style=dashed];`);
      }
    }
  }

  lines.push('');

  // Edges
  for (const edge of graph.edges) {
    const from = dotId(edge.from);
    const to = dotId(edge.to);
    const style = edge.type === 'local' ? '' : ' [style=dashed]';
    lines.push(`  ${from} -> ${to}${style};`);
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Convert a file path to a valid DOT identifier.
 */
function dotId(str) {
  return '"' + str.replace(/"/g, '\\"') + '"';
}

/**
 * Format graph as JSON.
 */
function formatJson(graph) {
  return JSON.stringify(graph, null, 2);
}

module.exports = { formatTree, formatDot, formatJson };
