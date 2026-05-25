import type { CommandHandler, ScanOptions } from '../types.js';
import { createLogger } from '../logger.js';
import { ProjectAnalyzer, ArchitectureGraph } from '@livingdocs/core';
import { glob } from 'glob';
import { resolve, relative, dirname, basename } from 'path';
import { mkdir } from 'fs/promises';

/**
 * Scan the codebase and update the architecture graph.
 *
 * This command performs static analysis, builds dependency graphs,
 * and updates the semantic index.
 */
export const scan: CommandHandler<ScanOptions> = async (options) => {
  const logger = createLogger(options);

  logger.header('Scanning Codebase');

  const startTime = Date.now();
  const projectRoot = options.path || process.cwd();

  try {
    // Find all TypeScript files
    logger.info('Finding TypeScript files...');
    const pattern = '**/*.{ts,tsx}';
    const ignore = ['**/node_modules/**', '**/dist/**', '**/.livingdocs/**', '**/build/**'];

    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore,
      absolute: true,
    });

    logger.info(`Found ${files.length} TypeScript files`);

    // Initialize analyzer and graph
    const analyzer = new ProjectAnalyzer();
    const graph = new ArchitectureGraph();

    // Set graph metadata
    graph.updateMetadata({
      projectRoot,
      version: '1.0.0',
    });

    // Parse each file and build graph
    logger.info('Parsing files and building graph...');
    let parsedCount = 0;
    let errorCount = 0;

    for (const filePath of files) {
      try {
        const analysis = await analyzer.analyzeFile(filePath);
        const relativePath = relative(projectRoot, filePath);

        // Add file node
        graph.addNode({
          id: `file:${relativePath}`,
          type: 'file',
          name: basename(filePath),
          path: relativePath,
          metadata: {
            lineCount: analysis.metrics.lineCount,
            symbolCount: analysis.metrics.symbolCount,
          },
        });

        // Add symbol nodes
        for (const symbol of analysis.parsedFile.symbols) {
          if (symbol.exported) {
            graph.addNode({
              id: `symbol:${relativePath}:${symbol.name}`,
              type: symbol.kind === 'function' ? 'function' : 'class',
              name: symbol.name,
              path: relativePath,
              metadata: {
                kind: symbol.kind,
                signature: symbol.signature,
              },
            });

            // Add edge from file to symbol
            graph.addEdge({
              id: `edge:${relativePath}:${symbol.name}`,
              source: `file:${relativePath}`,
              target: `symbol:${relativePath}:${symbol.name}`,
              type: 'exports',
            });
          }
        }

        // Add dependency edges
        for (const dep of analysis.dependencies) {
          const depRelative = relative(projectRoot, dep);
          const depId = `file:${depRelative}`;

          // Only add edge if target file exists in graph
          if (graph.hasNode(depId) || files.some(f => relative(projectRoot, f) === depRelative)) {
            graph.addEdge({
              id: `edge:${relativePath}:${depRelative}`,
              source: `file:${relativePath}`,
              target: depId,
              type: 'imports',
            });
          }
        }

        parsedCount++;
        if (parsedCount % 10 === 0) {
          logger.debug(`Parsed ${parsedCount}/${files.length} files`);
        }
      } catch (error) {
        errorCount++;
        logger.debug(`Error parsing ${filePath}: ${error}`);
      }
    }

    // Detect circular dependencies
    logger.info('Detecting circular dependencies...');
    const cycles = graph.detectCircularDependencies();

    // Save graph to .livingdocs/graph.json
    const livingDocsDir = resolve(projectRoot, '.livingdocs');
    await mkdir(livingDocsDir, { recursive: true });
    const graphPath = resolve(livingDocsDir, 'graph.json');
    await graph.saveToFile(graphPath);

    const duration = Date.now() - startTime;
    const stats = graph.getStats();

    // Output results
    if (options.json) {
      logger.json({
        status: 'success',
        duration,
        files: {
          total: files.length,
          parsed: parsedCount,
          errors: errorCount,
        },
        graph: {
          nodes: stats.nodeCount,
          edges: stats.edgeCount,
          nodeTypes: stats.nodeTypes,
          edgeTypes: stats.edgeTypes,
        },
        circularDependencies: cycles.length,
        outputPath: graphPath,
      });
    } else {
      logger.success(`\nScan completed in ${duration}ms`);
      logger.info(`\nFiles:`);
      logger.info(`  • Total: ${files.length}`);
      logger.info(`  • Parsed: ${parsedCount}`);
      logger.info(`  • Errors: ${errorCount}`);
      logger.info(`\nGraph:`);
      logger.info(`  • Nodes: ${stats.nodeCount}`);
      logger.info(`  • Edges: ${stats.edgeCount}`);

      if (cycles.length > 0) {
        logger.warn(`\n⚠️  Found ${cycles.length} circular dependencies`);
      }

      logger.info(`\nGraph saved to: ${graphPath}`);
    }
  } catch (error) {
    if (options.json) {
      logger.json({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      logger.error(`\nScan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  }
};
