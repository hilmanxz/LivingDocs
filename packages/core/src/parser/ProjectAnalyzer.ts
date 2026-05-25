import { readdirSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import type { FileAnalysis } from '@livingdocs/shared';
import { TypeScriptParser } from './TypeScriptParser.js';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const EXCLUDE_PATTERNS = ['node_modules', '.git', 'dist', 'build', '.turbo', 'coverage'];

/**
 * ProjectAnalyzer scans and analyzes TypeScript projects
 */
export class ProjectAnalyzer {
  private rootPath: string = '';
  private files: string[] = [];
  private parser = new TypeScriptParser();

  /**
   * Load a TypeScript project by scanning for all .ts/.tsx files
   */
  loadProject(rootPath: string): void {
    this.rootPath = resolve(rootPath);
    this.files = this.scanDirectory(this.rootPath);
  }

  /**
   * Recursively scan directory for TypeScript files
   */
  private scanDirectory(dir: string): string[] {
    const results: string[] = [];

    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (EXCLUDE_PATTERNS.includes(entry)) continue;

      const fullPath = join(dir, entry);

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        results.push(...this.scanDirectory(fullPath));
      } else if (TS_EXTENSIONS.has(extname(entry))) {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * Analyze a single file and return detailed analysis
   */
  analyzeFile(filePath: string): FileAnalysis {
    const absolutePath = resolve(filePath);

    let parsedFile;
    const errors: string[] = [];

    try {
      parsedFile = this.parser.parseFile(absolutePath);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      // Return minimal analysis on error
      return {
        filePath,
        absolutePath,
        parsedFile: {
          filePath,
          content: '',
          imports: [],
          exports: [],
          symbols: [],
          lineCount: 0,
        },
        dependencies: [],
        metrics: {
          importCount: 0,
          exportCount: 0,
          symbolCount: 0,
          lineCount: 0,
        },
        errors,
      };
    }

    // Collect dependency paths
    const dependencies = parsedFile.imports.map((imp) => imp.source);

    return {
      filePath,
      absolutePath,
      parsedFile,
      dependencies,
      metrics: {
        importCount: parsedFile.imports.length,
        exportCount: parsedFile.exports.length,
        symbolCount: parsedFile.symbols.length,
        lineCount: parsedFile.lineCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get all TypeScript files found in the project
   */
  getAllFiles(): string[] {
    return [...this.files];
  }

  /**
   * Get the project root path
   */
  getRootPath(): string {
    return this.rootPath;
  }

  /**
   * Clear parser cache
   */
  clearCache(): void {
    this.parser.clearCache();
  }
}
