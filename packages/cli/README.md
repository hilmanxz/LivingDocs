# @livingdocs/cli

CLI interface for LivingDocs - Documentation that evolves with your codebase.

## Installation

```bash
# From monorepo root
pnpm install

# Build the CLI
pnpm --filter @livingdocs/cli build
# or use tsc directly
npx tsc --project packages/cli/tsconfig.json
```

## Usage

```bash
# Run locally during development
node packages/cli/bin/livingdocs.js [command] [options]

# After publishing or linking
npx livingdocs [command] [options]
pnpm livingdocs [command] [options]
```

## Commands

- `livingdocs init` - Initialize a new LivingDocs project
- `livingdocs scan` - Scan codebase and update architecture graph
- `livingdocs watch` - Watch for file changes and update documentation automatically
- `livingdocs explain <path>` - Explain a specific file or folder
- `livingdocs generate` - Generate documentation from current codebase state
- `livingdocs status` - Show documentation freshness and system status

## Global Options

- `-v, --verbose` - Enable verbose logging output
- `-j, --json` - Format output as JSON instead of human-readable text
- `-V, --version` - Output the version number
- `-h, --help` - Display help for command

## Architecture

```
packages/cli/
├── bin/
│   └── livingdocs.js          # Executable entry point
├── src/
│   ├── index.ts               # Main CLI program (commander.js setup)
│   ├── types.ts               # TypeScript interfaces for all commands
│   ├── logger.ts              # Logging utility (respects --verbose/--json)
│   └── commands/
│       ├── init.ts            # Initialize project
│       ├── scan.ts            # Scan codebase
│       ├── watch.ts           # Watch for changes
│       ├── explain.ts         # Explain file/folder
│       ├── generate.ts        # Generate documentation
│       └── status.ts          # Show status
├── package.json
└── tsconfig.json
```

## How to Implement Command Logic

Each command handler is a separate module in `src/commands/`. To implement actual logic:

### 1. Command Handler Signature

Each command exports a handler function:

```typescript
import type { CommandHandler, ScanOptions } from '../types.js';
import { createLogger } from '../logger.js';

export const scan: CommandHandler<ScanOptions> = async (options) => {
  const logger = createLogger(options);
  
  // Your implementation here
  logger.info('Starting scan...');
  
  // Access global flags
  if (options.verbose) {
    logger.debug('Verbose mode enabled');
  }
  
  // Output JSON if requested
  if (options.json) {
    logger.json({ status: 'success', filesScanned: 42 });
  } else {
    logger.success('Scan complete!');
  }
};
```

### 2. Using the Logger

The `Logger` class respects `--verbose` and `--json` flags:

```typescript
logger.info('Regular message');           // Always shown (unless --json)
logger.success('Success message');        // Green checkmark
logger.warn('Warning message');           // Yellow warning
logger.error('Error message');            // Red X (shown in JSON mode too)
logger.debug('Debug message');            // Only shown with --verbose
logger.step(1, 5, 'Step 1 of 5');        // Progress indicator
logger.header('Section Header');          // Bold cyan header
logger.json({ key: 'value' });           // Output structured JSON
```

### 3. Adding Dependencies

To use other packages in your command:

```typescript
// Import from workspace packages
import { TypeScriptParser } from '@livingdocs/core';
import { ArchitectureGraph } from '@livingdocs/engine';
import type { FileNode } from '@livingdocs/shared';

// Import external packages (add to package.json first)
import fs from 'fs/promises';
import path from 'path';
```

### 4. Error Handling

Errors are automatically caught and formatted by the CLI framework:

```typescript
export const scan: CommandHandler<ScanOptions> = async (options) => {
  const logger = createLogger(options);
  
  // Just throw errors - they'll be caught and formatted
  if (!await fileExists('.livingdocs/config.json')) {
    throw new Error('Project not initialized. Run `livingdocs init` first.');
  }
  
  // Continue with implementation...
};
```

### 5. Command-Specific Options

To add command-specific options, update `src/index.ts`:

```typescript
program
  .command('scan')
  .description('Scan codebase and update architecture graph')
  .option('--incremental', 'perform incremental scan only')
  .option('--output <path>', 'output directory for results')
  .action((options) => handleAction(scan)(options));
```

Then update the type in `src/types.ts`:

```typescript
export interface ScanOptions extends GlobalOptions {
  incremental?: boolean;
  output?: string;
}
```

## Testing Commands

```bash
# Test help
node packages/cli/bin/livingdocs.js --help

# Test specific command
node packages/cli/bin/livingdocs.js init

# Test with flags
node packages/cli/bin/livingdocs.js scan --verbose
node packages/cli/bin/livingdocs.js status --json

# Test command with arguments
node packages/cli/bin/livingdocs.js explain src/services/auth
```

## Current Status

All commands are scaffolded with placeholder implementations that:
- Show "Not implemented yet" warnings
- Display what the command will do when implemented
- Demonstrate proper use of the logger
- Support `--verbose` and `--json` flags

Ready for implementation by other agents!
