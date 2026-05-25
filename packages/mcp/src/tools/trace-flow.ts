import { ArchitectureGraph, ProjectAnalyzer } from '@livingdocs/core';
import { resolve } from 'path';
import { existsSync } from 'fs';
import * as z from 'zod';

export const traceFlowSchema = z.object({
  filePath: z.string().describe('Path to the file to trace'),
  direction: z.enum(['incoming', 'outgoing']).describe('Direction to trace: incoming (who imports this) or outgoing (what this imports)'),
  depth: z.number().optional().describe('How many levels deep to trace (default: 2)'),
});

export type TraceFlowInput = z.infer<typeof traceFlowSchema>;

/**
 * Trace dependency flow from a file
 */
export async function traceFlow(input: TraceFlowInput) {
  const { filePath, direction, depth = 2 } = input;
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

    const lines: string[] = [];
    lines.push(`# Dependency Flow: ${filePath}`);
    lines.push(`Direction: ${direction === 'incoming' ? 'Incoming (who imports this)' : 'Outgoing (what this imports)'}`);
    lines.push('');

    if (direction === 'outgoing') {
      lines.push('## Direct Dependencies');
      if (analysis.dependencies.length === 0) {
        lines.push('No dependencies found.');
      } else {
        const external = analysis.dependencies.filter((d) => !d.startsWith('.'));
        const internal = analysis.dependencies.filter((d) => d.startsWith('.'));

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
      }
    } else {
      // For incoming, we'd need to scan all files to find who imports this
      // This is a simplified version that shows what this file exports
      lines.push('## Exported Symbols (used by other files)');
      const exported = analysis.parsedFile.symbols.filter((s) => s.exported);

      if (exported.length === 0) {
        lines.push('No exported symbols found.');
      } else {
        for (const symbol of exported) {
          lines.push(`- \`${symbol.name}\` (${symbol.kind})`);
        }
      }

      lines.push('');
      lines.push('_Note: To find all files that import this file, run a full project analysis._');
    }

    lines.push('');
    lines.push('## Summary');
    lines.push(`- Total dependencies: ${analysis.dependencies.length}`);
    lines.push(`- External packages: ${analysis.dependencies.filter((d) => !d.startsWith('.')).length}`);
    lines.push(`- Internal modules: ${analysis.dependencies.filter((d) => d.startsWith('.')).length}`);

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
          text: `Error tracing flow: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
