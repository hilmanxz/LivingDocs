import type { CommandHandler, InitOptions } from '../types.js';
import { createLogger } from '../logger.js';
import { resolve } from 'path';
import { mkdir, writeFile, access } from 'fs/promises';
import { scan } from './scan.js';

interface LivingDocsConfig {
  version: string;
  projectRoot: string;
  llmProvider?: 'openai' | 'anthropic';
  outputDir: string;
  exclude: string[];
  createdAt: string;
}

/**
 * Initialize a new LivingDocs project.
 *
 * This command sets up the necessary configuration files and
 * performs an initial scan of the codebase.
 */
export const init: CommandHandler<InitOptions> = async (options) => {
  const logger = createLogger(options);

  logger.header('Initializing LivingDocs');

  const projectRoot = process.cwd();
  const livingDocsDir = resolve(projectRoot, '.livingdocs');
  const configPath = resolve(livingDocsDir, 'config.json');

  try {
    // Check if already initialized
    try {
      await access(configPath);
      if (options.json) {
        logger.json({
          status: 'error',
          error: 'LivingDocs is already initialized in this directory',
        });
      } else {
        logger.error('LivingDocs is already initialized in this directory');
        logger.info(`Config file exists at: ${configPath}`);
      }
      process.exit(1);
    } catch {
      // Config doesn't exist, proceed with initialization
    }

    // Create .livingdocs directory
    logger.info('Creating .livingdocs directory...');
    await mkdir(livingDocsDir, { recursive: true });

    // Create config.json
    logger.info('Creating configuration file...');
    const config: LivingDocsConfig = {
      version: '1.0.0',
      projectRoot,
      llmProvider: (process.env.LLM_PROVIDER as 'openai' | 'anthropic') || 'openai',
      outputDir: './docs/living',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.livingdocs/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      createdAt: new Date().toISOString(),
    };

    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Create output directory
    const outputDir = resolve(projectRoot, config.outputDir);
    await mkdir(outputDir, { recursive: true });

    logger.success('Configuration created successfully');

    // Perform initial scan
    logger.info('\nPerforming initial scan...');
    await scan({ ...options, path: projectRoot });

    if (options.json) {
      logger.json({
        status: 'success',
        configPath,
        outputDir,
      });
    } else {
      logger.success('\n✓ LivingDocs initialized successfully!');
      logger.info('\nNext steps:');
      logger.info('  • Run `livingdocs generate` to create documentation');
      logger.info('  • Run `livingdocs explain <path>` to understand any file or folder');
      logger.info('  • Run `livingdocs watch` to keep docs updated automatically');
    }
  } catch (error) {
    if (options.json) {
      logger.json({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      logger.error(`\nInitialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  }
};
