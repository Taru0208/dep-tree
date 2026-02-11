# dep-tree

Trace import/require dependencies and visualize the dependency graph.

Supports JavaScript, TypeScript, and Python. No configuration needed — just point it at a directory.

## Install

```
npm install -g dep-tree
```

Or run directly:

```
npx dep-tree .
```

## Usage

```
dep-tree [dir]              Analyze current or given directory
dep-tree -e src/index.js    Start from specific entry point(s)
```

### Options

```
-f, --format <fmt>    Output format: tree, dot, json (default: tree)
-e, --entry <file>    Entry point(s) (repeatable; auto-detected if omitted)
-d, --depth <n>       Max traversal depth (default: unlimited)
--external            Include external (npm/pip) dependencies
--builtin             Include builtin (node/python stdlib) dependencies
--no-color            Disable color output
-h, --help            Show this help
-v, --version         Show version
```

## Examples

### Tree output (default)

```
$ dep-tree .
src/index.js
├── src/graph.js
│   ├── src/parsers/javascript.js
│   └── src/parsers/python.js
└── src/formatters.js

src/cli.js
├── src/graph.js
│   (circular)
└── src/formatters.js

6 files, 6 local deps
```

### DOT output (for Graphviz)

```
$ dep-tree . -f dot > deps.dot
$ dot -Tpng deps.dot -o deps.png
```

### JSON output

```
$ dep-tree . -f json
```

Returns `{ nodes, edges, externals, builtins, unresolved }`.

## Supported languages

| Language | Import styles |
|----------|--------------|
| JavaScript/TypeScript | `import`, `require()`, `export from`, `import()` |
| Python | `import`, `from ... import`, relative imports |

## Entry point detection

When no `-e` flag is given, dep-tree auto-detects entry points by checking:

1. `main` and `bin` fields in `package.json`
2. Common entry files: `index.js`, `main.py`, `app.js`, etc.

## License

MIT
