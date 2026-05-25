import type { CommandHandler, StatusOptions } from '../types.js';
import { createLogger } from '../logger.js';
import { ArchitectureGraph } from '@livingdocs/core';
import { resolve } from 'path';
import { stat, access, readFile } from 'fs/promises';

/**
 * Show documentation freshness and system status.
 *
 * This command displays the current state of documentation,
 * including what's up-to-date, stale, or missing.
 */
export const status: CommandHandler<StatusOptions> = async (options) => {
  const logger = createLogger(options);

  logger.header('Documentation Status');

  const projectRoot = process.cwd();
  const graphPath = resolve(projectRoot, '.livingdocs', 'graph.json');
  const configPath = resolve(projectRoot, '.livingdocs', 'config.json');

  try {
    // Check if initialized
    try {
      await access(configPath);
    } catch {
      if (options.json) {
        logger.json({
          status: 'error',
          error: 'LivingDocs not initialized. Run `livingdocs init` first.',
        });
      } else {
        logger.error('LivingDocs not initialized. Run `livingdocs init` first.');
      }
      process.exit(1);
    }

    // Load config
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    const outputDir = resolve(projectRoot, config.outputDir || 'docs/living');

    // Load graph
    let graph;
    let graphTimestamp = 0;
    try {
      graph = await ArchitectureGraph.loadFromFile(graphPath);
      const graphStat = await stat(graphPath);
      graphTimestamp = graphStat.mtimeMs;
    } catch {
      if (options.json) {
        logger.json({
          status: 'error',
          error: 'No graph found. Run `livingdocs scan` first.',
        });
      } else {
        logger.error('No graph found. Run `livingdocs scan` first.');
      }
      process.exit(1);
    }

    const stats = graph.getStats();
    const metadata = graph.getMetadata();

    // Check documentation files
    const docFiles = ['README.md', 'architecture.md', 'onboarding.md', 'api.md'];
    const docStatus: Array<{ file: string; exists: boolean; fresh: boolean; timestamp?: number }> = [];

    for (const file of docFiles) {
      const filePath = resolve(outputDir, file);
      try {
        const fileStat = await stat(filePath);
        const fresh = fileStat.mtimeMs >= graphTimestamp;
        docStatus.push({
          file,
          exists: true,
          fresh,
          timestamp: fileStat.mtimeMs,
        });
      } catch {
        docStatus.push({
          file,
          exists: false,
          fresh: false,
        });
      }
    }

    const existingDocs = docStatus.filter(d => d.exists);
    const freshDocs = docStatus.filter(d => d.fresh);
    const staleDocs = docStatus.filter(d => d.exists && !d.fresh);
    const missingDocs = docStatus.filter(d => !d.exists);

    // Calculate freshness score (0-100)
    const freshnessScore = existingDocs.length > 0
      ? Math.round((freshDocs.length / docFiles.length) * 100)
      : 0;

    // Format timestamps
    const lastScan = metadata?.updatedAt
      ? new Date(metadata.updatedAt).toLocaleString()
      : 'Unknown';

    if (options.json) {
      logger.json({
        status: 'success',
        freshnessScore,
        lastScan: metadata?.updatedAt,
        graph: {
          nodes: stats.nodeCount,
          edges: stats.edgeCount,
          nodeTypes: stats.nodeTypes,
        },
        documentation: {
          total: docFiles.length,
          existing: existingDocs.length,
          fresh: freshDocs.length,
          stale: staleDocs.length,
          missing: missingDocs.length,
        },
        files: docStatus,
      });
    } else {
      // Freshness indicator
      let freshnessEmoji = '🔴';
      let freshnessLabel = 'Stale';
      if (freshnessScore >= 80) {
        freshnessEmoji = '🟢';
        freshnessLabel = 'Fresh';
      } else if (freshnessScore >= 50) {
        freshnessEmoji = '🟡';
        freshnessLabel = 'Needs Update';
      }

      logger.info(`\n${freshnessEmoji} Freshness Score: ${freshnessScore}/100 (${freshnessLabel})`);
      logger.info(`📅 Last Scan: ${lastScan}`);
      logger.info('');

      // Graph stats
      logger.info('📊 Architecture Graph:');
      logger.info(`   • Nodes: ${stats.nodeCount}`);
      logger.info(`   • Edges: ${stats.edgeCount}`);
      logger.info('');

      // Documentation status
      logger.info('📚 Documentation:');
      logger.info(`   • Total: ${docFiles.length}`);
      logger.info(`   • Fresh: ${freshDocs.length}`);
      logger.info(`   • Stale: ${staleDocs.length}`);
      logger.info(`   • Missing: ${missingDocs.length}`);
      logger.info('');

      // File details
      if (staleDocs.length > 0) {
        logger.warn('⚠️  Stale Documentation:');
        for (const doc of staleDocs) {
          logger.warn(`   • ${doc.file}`);
        }
        logger.info('');
      }

      if (missingDocs.length > 0) {
        logger.warn('❌ Missing Documentation:');
        for (const doc of missingDocs) {
          logger.warn(`   • ${doc.file}`);
        }
        logger.info('');
      }

      // Recommendations
      if (staleDocs.length > 0 || missingDocs.length > 0) {
        logger.info('💡 Recommendation:');
        logger.info('   Run `livingdocs generate` to update documentation');
      } else if (freshDocs.length === docFiles.length) {
        logger.success('✓ All documentation is up to date!');
      }
    }
  } catch (error) {
    if (options.json) {
      logger.json({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      logger.error(`\nStatus check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  }
};
