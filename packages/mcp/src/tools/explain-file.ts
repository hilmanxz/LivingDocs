import { TypeScriptParser, ProjectAnalyzer } from '@livingdocs/core';
import { resolve } from 'path';
import { existsSync } from 'fs';
import * as z from 'zod';

export const explainFileSchema = z.object({
  filePath: z.string().describe('Path to the file to explain'),
});

export type ExplainFileInput = z.infer<typeof explainFileSchema>;

/**
 * Explain a file's purpose, exports, and dependencies
 */
export async function explainFile(input: ExplainFileInput) {
  const { filePath } = input;
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: File not found at path: ${absolutePath}`,
        },
      ],
    };
  }

  try {
    const analyzer = new ProjectAnalyzer();
    const analysis = analyzer.analyzeFile(absolutePath);

    const { parsedFile, dependencies, metrics } = analysis;

    // Build explanation
    const lines: string[] = [];
    lines.push(`# File Analysis: ${filePath}`);
    lines.push('');

    // Metrics
    lines.push('## Metrics');
    lines.push(`- Lines: ${metrics.lineCount}`);
    lines.push(`- Imports: ${metrics.importCount}`);
    lines.push(`- Exports: ${metrics.exportCount}`);
    lines.push(`- Symbols: ${metrics.symbolCount}`);
    lines.push('');

    // Exports
    if (parsedFile.exports.length > 0) {
      lines.push('## Exports');
      for (const exp of parsedFile.exports) {
        if (exp.type === 'named' && exp.name) {
          lines.push(`- \`${exp.name}\` (named export)`);
        } else if (exp.type === 'default') {
          lines.push(`- default export`);
        } else if (exp.type === 'all' && exp.source) {
          lines.push(`- re-export all from \`${exp.source}\``);
        }
      }
      lines.push('');
    }

    // Symbols
    if (parsedFile.symbols.length > 0) {
      lines.push('## Symbols');
      const exported = parsedFile.symbols.filter((s) => s.exported);
      const internal = parsedFile.symbols.filter((s) => !s.exported);

      if (exported.length > 0) {
        lines.push('### Exported');
        for (const symbol of exported) {
          lines.push(`- ${symbol.kind} \`${symbol.name}\``);
          if (symbol.signature) {
            lines.push(`  \`\`\`typescript\n  ${symbol.signature}\n  \`\`\``);
          }
        }
      }

      if (internal.length > 0) {
        lines.push('### Internal');
        for (const symbol of internal) {
          lines.push(`- ${symbol.kind} \`${symbol.name}\``);
        }
      }
      lines.push('');
    }

    // Dependencies
    if (dependencies.length > 0) {
      lines.push('## Dependencies');
      const external = dependencies.filter((d) => !d.startsWith('.'));
      const internal = dependencies.filter((d) => d.startsWith('.'));

      if (external.length > 0) {
        lines.push('### External');
        for (const dep of external) {
          lines.push(`- \`${dep}\``);
        }
      }

      if (internal.length > 0) {
        lines.push('### Internal');
        for (const dep of internal) {
          lines.push(`- \`${dep}\``);
        }
      }
      lines.push('');
    }

    // Purpose inference
    lines.push('## Purpose');
    const purpose = inferPurpose(parsedFile, dependencies);
    lines.push(purpose);

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.join('\n'),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error analyzing file: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Infer the purpose of a file based on its structure
 */
function inferPurpose(parsedFile: any, dependencies: string[]): string {
  const { symbols, exports } = parsedFile;

  // Check for common patterns
  const hasTests = parsedFile.filePath.includes('.test.') || parsedFile.filePath.includes('.spec.');
  const hasTypes = symbols.some((s: any) => s.kind === 'interface' || s.kind === 'type');
  const hasClasses = symbols.some((s: any) => s.kind === 'class');
  const hasFunctions = symbols.some((s: any) => s.kind === 'function');
  const hasReactImport = dependencies.some((d) => d === 'react' || d === 'react/jsx-runtime');
  const hasExpressImport = dependencies.some((d) => d.includes('express'));

  if (hasTests) {
    return 'This file contains test cases.';
  }

  if (hasReactImport && hasFunctions) {
    return 'This file defines React components.';
  }

  if (hasExpressImport) {
    return 'This file defines Express.js routes or middleware.';
  }

  if (hasTypes && !hasClasses && !hasFunctions) {
    return 'This file defines TypeScript types and interfaces.';
  }

  if (hasClasses && exports.length > 0) {
    return 'This file exports classes, likely service or utility classes.';
  }

  if (hasFunctions && exports.length > 0) {
    return 'This file exports utility functions or helpers.';
  }

  if (exports.some((e: any) => e.type === 'all')) {
    return 'This file serves as a barrel export, re-exporting from other modules.';
  }

  return 'This file is part of the codebase structure.';
}
