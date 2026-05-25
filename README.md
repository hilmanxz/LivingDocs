# LivingDocs

> Documentation that evolves with your codebase.

LivingDocs is an AI-powered engineering intelligence platform that continuously understands, maps, and documents software systems in real time. Unlike traditional documentation tools that become outdated quickly, LivingDocs automatically synchronizes documentation with codebase changes using static analysis, semantic reasoning, and AI-powered architecture understanding.

[![Tests](https://img.shields.io/badge/tests-161%20passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## Features

- **Static Intelligence Layer**
  - TypeScript AST parsing using TypeScript Compiler API
  - Recursive codebase analysis with metrics extraction
  - Extracts imports, exports, symbols, and source locations

- **Architecture Graph**
  - In-memory graph with O(1) lookups
  - BFS pathfinding and DFS circular dependency detection
  - JSON serialization for caching and graph diffing

- **Semantic Intelligence Layer**
  - Unified LLM interface for OpenAI and Anthropic Claude
  - Context-aware prompt assembly with token management
  - AI-powered file, folder, and module summarization

- **Documentation Engine**
  - Auto-generate README, architecture docs, onboarding guides, API docs
  - Mermaid diagram generation for dependency graphs and service maps
  - Template-based markdown generation

- **CLI Commands**
  - `init` - Initialize project with `.livingdocs` config
  - `scan` - Analyze codebase and build architecture graph
  - `generate` - Create all documentation from graph
  - `explain <path>` - Explain file/folder structure and dependencies
  - `status` - Track documentation freshness and report stale docs
  - `watch` - Monitor filesystem with auto-regeneration
  - `ask <question>` - Natural language query interface

- **AI Query Layer**
  - Natural language query interface for codebase understanding
  - Question classification (why, how, what, where, impact, dependency)
  - RAG-based answers with source tracing and confidence scoring

- **PR/Commit Summarization**
  - Git diff parsing and analysis
  - Architectural change detection and impact assessment
  - Automated PR summary generation with risk scoring

- **MCP Server**
  - Model Context Protocol server for AI agents
  - 6 tools: `explain_file`, `explain_folder`, `trace_flow`, `detect_impact`, `summarize_commit`, `generate_docs`
  - Compatible with Claude Desktop, Cursor, Continue.dev

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/livingdocs.git
cd livingdocs

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Initialize Your Project

```bash
# Navigate to your TypeScript project
cd /path/to/your/project

# Initialize LivingDocs
livingdocs init

# This creates:
# - .livingdocs/config.json
# - .livingdocs/graph.json (after initial scan)
```

### Generate Documentation

```bash
# Scan your codebase
livingdocs scan

# Generate all documentation
livingdocs generate

# Output: docs/living/
# - README.md
# - architecture.md
# - onboarding.md
# - api.md (if routes detected)
# - diagrams/
```

### Ask Questions About Your Codebase

```bash
# Set your LLM API key
export OPENAI_API_KEY=your-key-here
# or
export ANTHROPIC_API_KEY=your-key-here

# Ask natural language questions
livingdocs ask "Why does auth use Redis?"
livingdocs ask "How does a request reach the billing service?"
livingdocs ask "What modules depend on the database?"
```

## CLI Commands

### `livingdocs init`
Initialize LivingDocs in your project. Creates `.livingdocs/config.json` and runs initial scan.

```bash
livingdocs init
```

### `livingdocs scan`
Analyze your codebase and build the architecture graph.

```bash
livingdocs scan [--path <directory>]
```

**Output:**
- `.livingdocs/graph.json` - Serialized architecture graph
- Statistics: files parsed, nodes/edges created, circular dependencies detected

### `livingdocs generate`
Generate all documentation from the architecture graph.

```bash
livingdocs generate [--output <directory>]
```

**Output:**
- `README.md` - Project overview
- `architecture.md` - System architecture with Mermaid diagrams
- `onboarding.md` - Developer onboarding guide
- `api.md` - API documentation (if routes detected)
- `diagrams/` - Mermaid diagram files

### `livingdocs explain <path>`
Explain a specific file or folder.

```bash
livingdocs explain src/auth.ts
livingdocs explain src/services/
```

**Output:**
- File: imports, exports, symbols, dependencies, dependents
- Folder: file count, key files, public API

### `livingdocs status`
Check documentation freshness and system status.

```bash
livingdocs status
```

**Output:**
- Freshness score (0-100)
- Last scan timestamp
- Stale/missing documentation warnings

### `livingdocs watch`
Watch for file changes and auto-update documentation.

```bash
livingdocs watch [--no-generate]
```

Monitors TypeScript files and triggers incremental scans on changes.

### `livingdocs ask <question>`
Ask natural language questions about your codebase.

```bash
livingdocs ask "Why does auth use Redis?"
livingdocs ask "How does request flow work?"
livingdocs ask "What depends on the database module?"
```

**Requires:** `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variable.

### `livingdocs mcp`
Start the MCP server for AI agent integration.

```bash
livingdocs mcp
```

## MCP Integration

LivingDocs exposes a Model Context Protocol (MCP) server that AI agents can use to understand codebases.

### Setup with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "livingdocs": {
      "command": "node",
      "args": ["/path/to/livingdocs/packages/mcp/dist/index.js"]
    }
  }
}
```

### Available MCP Tools

| Tool | Description | Input |
|------|-------------|-------|
| `explain_file` | Explain a file's purpose, exports, dependencies | `{ filePath: string }` |
| `explain_folder` | Explain a folder's structure and key files | `{ folderPath: string }` |
| `trace_flow` | Trace dependency flow (incoming/outgoing) | `{ filePath: string, direction: "incoming" \| "outgoing" }` |
| `detect_impact` | Detect impact of changing a file | `{ filePath: string }` |
| `summarize_commit` | Summarize git commit changes | `{ commitHash?: string }` |
| `generate_docs` | Generate documentation | `{ path: string, type: "readme" \| "architecture" \| "onboarding" \| "api" }` |

## Architecture

LivingDocs is organized as a TypeScript monorepo with 5 packages:

```
packages/
├── shared/       # Shared types and utilities
├── core/         # Core analysis engine
│   ├── parser/   # TypeScript AST parsing
│   ├── graph/    # Architecture graph data structure
│   ├── semantic/ # LLM integration and summarization
│   ├── query/    # Natural language query engine
│   └── changes/  # Git diff analysis and PR summarization
├── engine/       # Documentation generation
│   └── templates/ # Markdown and Mermaid generators
├── cli/          # Command-line interface
└── mcp/          # MCP server for AI agents
```

### Data Flow

```
TypeScript Files
    ↓
TypeScriptParser (AST parsing)
    ↓
ArchitectureGraph (dependency graph)
    ↓
Summarizer (AI-powered semantic understanding)
    ↓
Templates (markdown generation)
    ↓
Documentation Files
```

## Development

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @livingdocs/core test

# Run tests in watch mode
pnpm test --watch
```

**Test Coverage:**
- 161 tests across 11 test files
- Core: 73 tests (parser, graph, semantic, query, changes)
- Engine: 31 tests (templates)
- MCP: 17 tests (tools)

### Build

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @livingdocs/cli build
```

### Lint & Format

```bash
# Lint
pnpm lint

# Format
pnpm format
```

## Roadmap

### Multi-Language Support
- Python support with AST parsing
- Go support with AST parsing
- Java support with AST parsing
- Language-agnostic architecture graph

### Historical Architecture Memory
- Track architecture changes over time
- Visualize architecture evolution
- Compare architecture across commits
- Detect architectural drift

### Engineering Decision Tracking
- ADR (Architecture Decision Records) integration
- Automatic decision extraction from commits
- Decision impact analysis
- Decision timeline visualization

### Autonomous Documentation Repair
- Detect stale documentation automatically
- Propose documentation updates
- Auto-fix outdated code examples
- Validate documentation against code

### Enterprise Features
- Team collaboration features
- Slack integration for architecture alerts
- Internal knowledge graph (organization-wide)
- Engineering intelligence dashboard
- Multi-repository support
- Access control and permissions

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

Built with:
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- OpenAI & Anthropic Claude APIs

---

**LivingDocs** - Documentation that evolves with your codebase.
