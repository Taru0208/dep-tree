/**
 * JavaScript/TypeScript import parser.
 * Extracts import/require dependencies from source files using regex.
 * Handles: ES modules (import), CommonJS (require), dynamic import().
 */

/**
 * Parse a JavaScript/TypeScript source string and extract dependencies.
 * @param {string} source - File contents
 * @returns {string[]} - Array of import specifiers
 */
function parse(source) {
  const stripped = stripComments(source);
  const deps = new Set();

  // ES module: import ... from 'module' (must start at line beginning or after semicolon)
  const esImport = /(?:^|;|\})\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  let match;
  while ((match = esImport.exec(stripped)) !== null) {
    deps.add(match[1]);
  }

  // ES module: export ... from 'module'
  const esExport = /(?:^|;|\})\s*export\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  while ((match = esExport.exec(stripped)) !== null) {
    deps.add(match[1]);
  }

  // CommonJS: require('module')
  const cjsRequire = /(?:^|[^.\w])require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = cjsRequire.exec(stripped)) !== null) {
    deps.add(match[1]);
  }

  // Dynamic import: import('module') — distinguished by ( immediately after import
  const dynamicImport = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = dynamicImport.exec(stripped)) !== null) {
    deps.add(match[1]);
  }

  return [...deps];
}

/**
 * Strip comments from JS/TS source while preserving strings intact.
 */
function stripComments(source) {
  let result = '';
  let i = 0;
  while (i < source.length) {
    // Single-line comment
    if (source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    }
    // Multi-line comment
    else if (source[i] === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
    }
    // Template literal — preserve as-is
    else if (source[i] === '`') {
      result += source[i++];
      while (i < source.length && source[i] !== '`') {
        if (source[i] === '\\') result += source[i++];
        if (i < source.length) result += source[i++];
      }
      if (i < source.length) result += source[i++];
    }
    // String — preserve as-is
    else if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      result += source[i++];
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') result += source[i++];
        if (i < source.length) result += source[i++];
      }
      if (i < source.length) result += source[i++];
    }
    else {
      result += source[i++];
    }
  }
  return result;
}

/**
 * Classify a dependency as local, builtin, or external.
 */
function classify(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return 'local';
  }
  if (isNodeBuiltin(specifier)) {
    return 'builtin';
  }
  return 'external';
}

const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'http2',
  'https', 'module', 'net', 'os', 'path', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder',
  'sys', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'wasi',
  'worker_threads', 'zlib', 'test', 'node:test',
]);

function isNodeBuiltin(specifier) {
  if (specifier.startsWith('node:')) return true;
  const base = specifier.split('/')[0];
  return NODE_BUILTINS.has(base);
}

module.exports = { parse, classify, stripComments };
