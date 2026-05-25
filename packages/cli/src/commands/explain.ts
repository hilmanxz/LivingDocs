import type { CommandHandler, ExplainOptions } from '../types.js';
import { createLogger } from '../logger.js';
import { TypeScriptParser, ArchitectureGraph } from '@livingdocs/core';
import { resolve, relative, basename } from 'path';
import { stat, readdir } from 'fs/promises';

/**
 * Explain a specific file or folder in the codebase.
 *
 * This command provides semantic understanding of code structure,
 * purpose, dependencies, and relationships.
 */
export const explain: CommandHandler<ExplainOptions> = async (options) => {
  const logger = createLogger(options);
  const targetPath = resolve(options.path);
  const projectRoot = process.cwd();

  logger.header(`Explaining: ${relative(projectRoot, targetPath)}`);

  try {
    const targetStat = await stat(targetPath);

    if (targetStat.isFile()) {
      await explainFile(targetPath, projectRoot, logger, options);
    } else if (targetStat.isDirectory()) {
      await explainFolder(targetPath, projectRoot, logger, options);
    } else {
      logger.error('Path is neither a file nor a directory');
      process.exit(1);
    }
  } catch (error) {
    if (options.json) {
      logger.json({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      logger.error(`\nExplain failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  }
};

async function explainFile(
  filePath: string,
  projectRoot: string,
  logger: any,
  options: ExplainOptions
) {
  const parser = new TypeScriptParser();
  const parsed = parser.parseFile(filePath);
  const relativePath = relative(projectRoot, filePath);

  const exportedSymbols = parsed.symbols.filter(s => s.exported);
  const internalSymbols = parsed.symbols.filter(s => !s.exported);

  // Try to load graph for dependency info
  let dependents: string[] = [];
  let dependencies: string[] = [];
  try {
    const graphPath = resolve(projectRoot, '.livingdocs', 'graph.json');
    const graph = await ArchitectureGraph.loadFromFile(graphPath);
    const nodeId = `file:${relativePath}`;
    const neighbors = graph.getNeighbors(nodeId);
    dependents = neighbors.incoming.map(n => n.path || n.name);
    dependencies = neighbors.outgoing.map(n => n.path || n.name);
  } catch {
    // Graph not available, skip dependency info
  }

  if (options.json) {
    logger.json({
      status: 'success',
      type: 'file',
      path: relativePath,
      name: basename(filePath),
      metrics: {
        lines: parsed.lineCount,
        imports: parsed.imports.length,
        exports: parsed.exports.length,
        symbols: parsed.symbols.length,
      },
      exports: exportedSymbols.map(s => ({ name: s.name, kind: s.kind })),
      imports: parsed.imports.map(i => ({
        source: i.source,
        specifiers: i.specifiers.map(s => s.name),
      })),
      dependencies,
      dependents,
    });
  } else {
    logger.info(`\n📄 File: ${relativePath}`);
    logger.info(`   Lines: ${parsed.lineCount}`);
    logger.info('');

    // Imports
    if (parsed.imports.length > 0) {
      logger.info('📥 Imports:');
      for (const imp of parsed.imports) {
        const specifiers = imp.specifiers.map(s => s.name).join(', ');
        logger.info(`   • ${imp.source} → { ${specifiers} }`);
      }
      logger.info('');
    }

    // Exported symbols
    if (exportedSymbols.length > 0) {
      logger.info('📤 Exports:');
      for (const sym of exportedSymbols) {
        logger.info(`   • ${sym.kind} ${sym.name}`);
      }
      logger.info('');
    }

    // Internal symbols
    if (internalSymbols.length > 0) {
      logger.info('🔒 Internal:');
      for (const sym of internalSymbols) {
        logger.info(`   • ${sym.kind} ${sym.name}`);
      }
      logger.info('');
    }

    // Dependencies from graph
    if (dependencies.length > 0) {
      logger.info('➡️  Depends on:');
      for (const dep of dependencies) {
        logger.info(`   • ${dep}`);
      }
      logger.info('');
    }

    if (dependents.length > 0) {
      logger.info('⬅️  Used by:');
      for (const dep of dependents) {
        logger.info(`   • ${dep}`);
      }
      logger.info('');
    }
  }
}

async function explainFolder(
  folderPath: string,
  projectRoot: string,
  logger: any,
  options: ExplainOptions
) {
  const parser = new TypeScriptParser();
  const relativePath = relative(projectRoot, folderPath);

  // Find TypeScript files in folder
  const entries = await readdir(folderPath, { withFileTypes: true, recursive: true });
  const tsFiles = entries
    .filter(e => e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx')))
    .filter(e => !e.name.includes('.test.') && !e.name.includes('.spec.'))
    .map(e => resolve(e.parentPath || e.path, e.name));

  // Parse all files
  const parsedFiles = [];
  let totalLines = 0;
  let totalSymbols = 0;
  let totalExports = 0;

  for (const file of tsFiles) {
    try {
      const parsed = parser.parseFile(file);
      parsedFiles.push({ file: relative(projectRoot, file), parsed });
      totalLines += parsed.lineCount;
      totalSymbols += parsed.symbols.length;
      totalExports += parsed.exports.length;
    } catch {
      // Skip unparseable files
    }
  }

  if (options.json) {
    logger.json({
      status: 'success',
      type: 'folder',
      path: relativePath,
      metrics: {
        files: tsFiles.length,
        totalLines,
        totalSymbols,
        totalExports,
      },
      files: parsedFiles.map(f => ({
        path: f.file,
        lines: f.parsed.lineCount,
        exports: f.parsed.symbols.filter(s => s.exported).map(s => s.name),
      })),
    });
  } else {
    logger.info(`\n📁 Folder: ${relativePath}`);
    logger.info(`   Files: ${tsFiles.length}`);
    logger.info(`   Total Lines: ${totalLines}`);
    logger.info(`   Total Symbols: ${totalSymbols}`);
    logger.info(`   Total Exports: ${totalExports}`);
    logger.info('');

    // Key files
    logger.info('📄 Key Files:');
    const sorted = parsedFiles
      .sort((a, b) => b.parsed.symbols.length - a.parsed.symbols.length)
      .slice(0, 10);

    for (const { file, parsed } of sorted) {
      const exports = parsed.symbols.filter(s => s.exported);
      logger.info(`   • ${file} (${parsed.lineCount} lines, ${exports.length} exports)`);
    }
    logger.info('');

    // All exported symbols
    const allExports = parsedFiles.flatMap(f =>
      f.parsed.symbols.filter(s => s.exported).map(s => ({ ...s, file: f.file }))
    );

    if (allExports.length > 0) {
      logger.info('📤 Public API:');
      for (const sym of allExports.slice(0, 15)) {
        logger.info(`   • ${sym.kind} ${sym.name} (${sym.file})`);
      }
      if (allExports.length > 15) {
        logger.info(`   ... and ${allExports.length - 15} more`);
      }
    }
  }
}
