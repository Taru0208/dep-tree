const fs = require('fs');
const path = require('path');
const jsParser = require('./parsers/javascript');
const pyParser = require('./parsers/python');

const EXTENSIONS = {
  javascript: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts'],
  python: ['.py'],
};

const PARSER_MAP = {
  javascript: jsParser,
  python: pyParser,
};

/**
 * Detect language from file extension.
 */
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  for (const [lang, exts] of Object.entries(EXTENSIONS)) {
    if (exts.includes(ext)) return lang;
  }
  return null;
}

/**
 * Resolve a local import specifier to an actual file path.
 * Tries common resolution strategies (exact, with extensions, index files).
 */
function resolveLocal(specifier, fromFile, rootDir) {
  const dir = path.dirname(fromFile);
  const target = path.resolve(dir, specifier);
  const lang = detectLanguage(fromFile);
  const exts = lang ? EXTENSIONS[lang] : [];

  // Try exact path
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return path.relative(rootDir, target);
  }

  // Try with extensions
  for (const ext of exts) {
    const withExt = target + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return path.relative(rootDir, withExt);
    }
  }

  // Try as directory with index file
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    for (const ext of exts) {
      const indexFile = path.join(target, 'index' + ext);
      if (fs.existsSync(indexFile)) {
        return path.relative(rootDir, indexFile);
      }
    }
  }

  return null; // unresolved
}

/**
 * Build a dependency graph starting from entry files.
 * @param {string[]} entries - Entry file paths (absolute or relative to rootDir)
 * @param {object} options
 * @param {string} options.rootDir - Project root
 * @param {boolean} options.includeExternal - Include external deps (default: false)
 * @param {boolean} options.includeBuiltin - Include builtin deps (default: false)
 * @param {number} options.maxDepth - Max traversal depth (default: Infinity)
 * @returns {object} Graph with nodes and edges
 */
function buildGraph(entries, options = {}) {
  const {
    rootDir = process.cwd(),
    includeExternal = false,
    includeBuiltin = false,
    maxDepth = Infinity,
  } = options;

  const nodes = new Map(); // relativePath -> { path, language, deps }
  const edges = [];        // { from, to, specifier, type }
  const externals = new Set();
  const builtins = new Set();
  const unresolved = [];

  const queue = entries.map(e => ({
    file: path.isAbsolute(e) ? e : path.resolve(rootDir, e),
    depth: 0,
  }));
  const visited = new Set();

  while (queue.length > 0) {
    const { file, depth } = queue.shift();
    const relPath = path.relative(rootDir, file);

    if (visited.has(relPath)) continue;
    visited.add(relPath);

    if (!fs.existsSync(file)) continue;

    const lang = detectLanguage(file);
    if (!lang) continue;

    const parser = PARSER_MAP[lang];
    const source = fs.readFileSync(file, 'utf-8');
    const deps = parser.parse(source);

    nodes.set(relPath, { path: relPath, language: lang, depCount: deps.length });

    for (const dep of deps) {
      const type = parser.classify(dep);

      if (type === 'local') {
        const resolved = resolveLocal(dep, file, rootDir);
        if (resolved) {
          edges.push({ from: relPath, to: resolved, specifier: dep, type: 'local' });
          if (depth < maxDepth) {
            queue.push({ file: path.resolve(rootDir, resolved), depth: depth + 1 });
          }
        } else {
          unresolved.push({ from: relPath, specifier: dep });
        }
      } else if (type === 'external') {
        externals.add(dep);
        if (includeExternal) {
          edges.push({ from: relPath, to: `[ext] ${dep}`, specifier: dep, type: 'external' });
        }
      } else if (type === 'builtin') {
        builtins.add(dep);
        if (includeBuiltin) {
          edges.push({ from: relPath, to: `[builtin] ${dep}`, specifier: dep, type: 'builtin' });
        }
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges,
    externals: [...externals].sort(),
    builtins: [...builtins].sort(),
    unresolved,
  };
}

/**
 * Auto-discover entry points in a directory.
 * Looks for common patterns: main in package.json, index files, etc.
 */
function discoverEntries(rootDir) {
  const entries = [];

  // Check package.json for main/bin
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.main) entries.push(pkg.main);
      if (pkg.bin) {
        const bins = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin);
        entries.push(...bins);
      }
    } catch {}
  }

  // Look for common entry files
  const commonEntries = [
    'index.js', 'index.ts', 'src/index.js', 'src/index.ts',
    'main.js', 'main.ts', 'src/main.js', 'src/main.ts',
    'app.js', 'app.ts', 'src/app.js', 'src/app.ts',
    'main.py', 'app.py', 'src/main.py',
  ];

  for (const entry of commonEntries) {
    const full = path.join(rootDir, entry);
    if (fs.existsSync(full) && !entries.includes(entry)) {
      entries.push(entry);
    }
  }

  return [...new Set(entries)];
}

module.exports = { buildGraph, discoverEntries, detectLanguage, resolveLocal };
