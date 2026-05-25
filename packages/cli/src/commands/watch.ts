import type { CommandHandler, WatchOptions } from '../types.js';
import { createLogger } from '../logger.js';
import { watch as fsWatch } from 'fs';
import { resolve, relative } from 'path';
import { scan } from './scan.js';
import { generate } from './generate.js';

/**
 * Watch for file changes and automatically update documentation.
 *
 * This command runs in the background, monitoring the codebase
 * for changes and triggering incremental updates.
 */
export const watch: CommandHandler<WatchOptions> = async (options) => {
  const logger = createLogger(options);

  logger.header('Starting Watch Mode');

  const projectRoot = process.cwd();
  const watchPaths = [resolve(projectRoot, 'src'), resolve(projectRoot, 'packages')];

  // Debounce settings
  let debounceTimer: NodeJS.Timeout | null = null;
  const debounceDelay = 1000; // 1 second
  const changedFiles = new Set<string>();

  logger.info('👀 Watching for changes...');
  logger.info(`   Paths: ${watchPaths.map(p => relative(projectRoot, p)).join(', ')}`);
  logger.info('   Press Ctrl+C to stop\n');

  const handleChange = async () => {
    if (changedFiles.size === 0) return;

    const files = Array.from(changedFiles);
    changedFiles.clear();

    logger.info(`\n📝 Detected changes in ${files.length} file(s)`);
    for (const file of files.slice(0, 5)) {
      logger.info(`   • ${relative(projectRoot, file)}`);
    }
    if (files.length > 5) {
      logger.info(`   ... and ${files.length - 5} more`);
    }

    try {
      // Run scan
      logger.info('\n🔍 Running incremental scan...');
      await scan({ ...options, path: projectRoot });

      // Auto-generate docs if enabled
      if (!options.noGenerate) {
        logger.info('\n📚 Regenerating documentation...');
        await generate({ ...options, path: projectRoot });
      }

      logger.success('\n✓ Update complete');
      logger.info('\n👀 Watching for changes...\n');
    } catch (error) {
      logger.error(`\n❌ Update failed: ${error instanceof Error ? error.message : String(error)}`);
      logger.info('\n👀 Watching for changes...\n');
    }
  };

  const queueChange = (filePath: string) => {
    // Only watch TypeScript files
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return;
    }

    // Ignore test files, node_modules, dist, etc.
    const relativePath = relative(projectRoot, filePath);
    if (
      relativePath.includes('node_modules') ||
      relativePath.includes('dist') ||
      relativePath.includes('build') ||
      relativePath.includes('.livingdocs') ||
      relativePath.includes('.test.') ||
      relativePath.includes('.spec.')
    ) {
      return;
    }

    changedFiles.add(filePath);

    // Debounce: wait for changes to settle
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      handleChange();
    }, debounceDelay);
  };

  // Watch each path
  const watchers = watchPaths.map(watchPath => {
    try {
      const watcher = fsWatch(
        watchPath,
        { recursive: true },
        (eventType, filename) => {
          if (filename) {
            const fullPath = resolve(watchPath, filename);
            queueChange(fullPath);
          }
        }
      );

      return watcher;
    } catch (error) {
      logger.debug(`Could not watch ${watchPath}: ${error}`);
      return null;
    }
  }).filter(Boolean);

  if (watchers.length === 0) {
    logger.error('No valid paths to watch. Make sure src/ or packages/ directories exist.');
    process.exit(1);
  }

  // Handle graceful shutdown
  const cleanup = () => {
    logger.info('\n\n👋 Stopping watch mode...');
    watchers.forEach(watcher => watcher?.close());
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep process alive
  await new Promise(() => {});
};
