import { Command } from 'commander';
import { createLogger } from './logger.js';
import { init } from './commands/init.js';
import { scan } from './commands/scan.js';
import { watch } from './commands/watch.js';
import { explain } from './commands/explain.js';
import { generate } from './commands/generate.js';
import { status } from './commands/status.js';
import type { GlobalOptions } from './types.js';

const VERSION = '0.1.0';

/**
 * Create and configure the CLI program.
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('livingdocs')
    .description('Documentation that evolves with your codebase')
    .version(VERSION)
    .option('-v, --verbose', 'enable verbose logging output', false)
    .option('-j, --json', 'format output as JSON', false);

  // Helper to merge global options with command options and execute
  const handleAction = <T extends Record<string, any>>(
    handler: (opts: T) => Promise<void>,
    extraOpts: Record<string, any> = {}
  ) => {
    return async (options: Record<string, unknown>) => {
      const globalOpts = program.opts<GlobalOptions>();
      try {
        await handler({ ...globalOpts, ...options, ...extraOpts } as unknown as T);
      } catch (error) {
        const logger = createLogger(globalOpts);
        const message = error instanceof Error ? error.message : String(error);
        logger.error(message);
        if (globalOpts.verbose && error instanceof Error) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    };
  };

  // livingdocs init
  program
    .command('init')
    .description('Initialize a new LivingDocs project')
    .action((options) => handleAction(init)(options));

  // livingdocs scan
  program
    .command('scan')
    .description('Scan codebase and update architecture graph')
    .action((options) => handleAction(scan)(options));

  // livingdocs watch
  program
    .command('watch')
    .description('Watch for file changes and update documentation automatically')
    .action((options) => handleAction(watch)(options));

  // livingdocs explain <path>
  program
    .command('explain <path>')
    .description('Explain a specific file or folder')
    .action((path, options) => handleAction(explain, { path })(options));

  // livingdocs generate
  program
    .command('generate')
    .description('Generate documentation from current codebase state')
    .action((options) => handleAction(generate)(options));

  // livingdocs status
  program
    .command('status')
    .description('Show documentation freshness and system status')
    .action((options) => handleAction(status)(options));

  // Help text
  program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ livingdocs init');
    console.log('  $ livingdocs scan');
    console.log('  $ livingdocs watch');
    console.log('  $ livingdocs explain src/services/auth');
    console.log('  $ livingdocs generate');
    console.log('  $ livingdocs status');
    console.log('');
    console.log('Global Options:');
    console.log('  -v, --verbose    Enable verbose logging');
    console.log('  -j, --json       Format output as JSON');
    console.log('');
  });

  return program;
}

/**
 * Main entry point for the CLI.
 * Called from bin/livingdocs.js
 */
export async function run(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}
