/**
 * Python import parser.
 * Extracts import dependencies from Python source files using regex.
 * Handles: import x, from x import y, relative imports.
 */

const PATTERNS = [
  // from module import ...
  /^[ \t]*from\s+(\.{0,3}[\w.]*)\s+import\s/gm,
  // import module, module2
  /^[ \t]*import\s+([\w.][\w.,\s]*)/gm,
];

/**
 * Parse a Python source string and extract dependencies.
 * @param {string} source - File contents
 * @returns {string[]} - Array of import module names
 */
function parse(source) {
  const stripped = stripComments(source);
  const deps = new Set();

  // from X import ...
  const fromPattern = /^[ \t]*from\s+(\.{0,3}[\w.]*)\s+import\s/gm;
  let match;
  while ((match = fromPattern.exec(stripped)) !== null) {
    const mod = match[1].trim();
    if (mod) deps.add(mod);
  }

  // import X, Y, Z
  const importPattern = /^[ \t]*import\s+([\w.][\w., \t]*)/gm;
  while ((match = importPattern.exec(stripped)) !== null) {
    const modules = match[1].split(',');
    for (const m of modules) {
      // Handle "import x as y" — take only the module name
      const name = m.trim().split(/\s+as\s+/)[0].trim();
      if (name && /^[\w.]+$/.test(name)) {
        deps.add(name);
      }
    }
  }

  return [...deps];
}

/**
 * Strip Python comments and docstrings.
 */
function stripComments(source) {
  let result = '';
  let i = 0;
  while (i < source.length) {
    // Triple-quoted strings (""" or ''')
    if (
      (source[i] === '"' && source[i+1] === '"' && source[i+2] === '"') ||
      (source[i] === "'" && source[i+1] === "'" && source[i+2] === "'")
    ) {
      const quote = source.slice(i, i + 3);
      i += 3;
      while (i < source.length && source.slice(i, i + 3) !== quote) i++;
      i += 3;
      result += '""';  // placeholder to maintain structure
    }
    // Single-line comment
    else if (source[i] === '#') {
      while (i < source.length && source[i] !== '\n') i++;
    }
    // Regular string
    else if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      result += source[i++];
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') result += source[i++];
        result += source[i++];
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
 * Classify a Python dependency.
 */
function classify(specifier) {
  if (specifier.startsWith('.')) {
    return 'local';
  }
  if (PYTHON_STDLIB.has(specifier.split('.')[0])) {
    return 'builtin';
  }
  return 'external';
}

// Common Python standard library modules
const PYTHON_STDLIB = new Set([
  'abc', 'argparse', 'ast', 'asyncio', 'base64', 'bisect', 'builtins',
  'calendar', 'cmath', 'codecs', 'collections', 'concurrent', 'configparser',
  'contextlib', 'copy', 'csv', 'ctypes', 'dataclasses', 'datetime',
  'decimal', 'difflib', 'email', 'enum', 'errno', 'fcntl', 'fileinput',
  'fnmatch', 'fractions', 'ftplib', 'functools', 'gc', 'getpass', 'glob',
  'gzip', 'hashlib', 'heapq', 'hmac', 'html', 'http', 'importlib',
  'inspect', 'io', 'itertools', 'json', 'keyword', 'linecache', 'locale',
  'logging', 'lzma', 'math', 'mimetypes', 'multiprocessing', 'numbers',
  'operator', 'os', 'pathlib', 'pdb', 'pickle', 'pkgutil', 'platform',
  'pprint', 'profile', 'queue', 'random', 're', 'readline', 'reprlib',
  'secrets', 'select', 'shelve', 'shlex', 'shutil', 'signal', 'site',
  'smtplib', 'socket', 'sqlite3', 'ssl', 'stat', 'statistics', 'string',
  'struct', 'subprocess', 'sys', 'syslog', 'tempfile', 'textwrap',
  'threading', 'time', 'timeit', 'tkinter', 'tomllib', 'trace', 'traceback',
  'types', 'typing', 'unittest', 'urllib', 'uuid', 'venv', 'warnings',
  'weakref', 'webbrowser', 'xml', 'xmlrpc', 'zipfile', 'zipimport', 'zlib',
  '_thread',
]);

module.exports = { parse, classify, stripComments };
