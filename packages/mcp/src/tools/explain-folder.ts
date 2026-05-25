import { ProjectAnalyzer } from '@livingdocs/core';
import { resolve } from 'path';
import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import * as z from 'zod';

export const explainFolderSchema = z.object({
  folderPath: z.string().describe('Path to the folder to explain'),
});

export type ExplainFolderInput = z.infer<typeof explainFolderSchema>;

/**
 * Explain a folder's purpose and key files
 */
export async function explainFolder(input: ExplainFolderInput) {
  const { folderPath } = input;
  const absolutePath = resolve(folderPath);

  if (!existsSync(absolutePath)) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: Folder not found at path: ${absolutePath}`,
        },
      ],
    };
  }

  if (!statSync(absolutePath).isDirectory()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: Path is not a directory: ${absolutePath}`,
        },
      ],
    };
  }

  try {
    const analyzer = new ProjectAnalyzer();
    analyzer.loadProject(absolutePath);
    const files = analyzer.getAllFiles();

    // Analyze key files
    const fileAnalyses = files.slice(0, 10).map((file) => {
      try {
        return analyzer.analyzeFile(file);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Build explanation
    const lines: string[] = [];
    lines.push(`# Folder Analysis: ${folderPath}`);
    lines.push('');

    // Overview
    lines.push('## Overview');
    lines.push(`- Total TypeScript files: ${files.length}`);
    lines.push(`- Analyzed files: ${fileAnalyses.length}`);
    lines.push('');

    // Folder structure
    lines.push('## Structure');
    const structure = getFolderStructure(absolutePath);
    for (const item of structure) {
      lines.push(item);
    }
    lines.push('');

    // Key files
    if (fileAnalyses.length > 0) {
      lines.push('## Key Files');

      // Find index/entry files
      const entryFiles = fileAnalyses.filter((a) =>
        a!.filePath.includes('index.ts') ||
        a!.filePath.includes('main.ts') ||
        a!.filePath.includes('app.ts')
      );

      if (entryFiles.length > 0) {
        lines.push('### Entry Points');
        for (const analysis of entryFiles) {
          const relativePath = analysis!.filePath.replace(absolutePath, '.');
          lines.push(`- \`${relativePath}\``);
          lines.push(`  - Exports: ${analysis!.metrics.exportCount}`);
          lines.push(`  - Imports: ${analysis!.metrics.importCount}`);
        }
        lines.push('');
      }

      // Files with most exports (likely public API)
      const publicFiles = fileAnalyses
        .filter((a) => a!.metrics.exportCount > 0)
        .sort((a, b) => b!.metrics.exportCount - a!.metrics.exportCount)
        .slice(0, 5);

      if (publicFiles.length > 0) {
        lines.push('### Public API Files');
        for (const analysis of publicFiles) {
          const relativePath = analysis!.filePath.replace(absolutePath, '.');
          lines.push(`- \`${relativePath}\` (${analysis!.metrics.exportCount} exports)`);
        }
        lines.push('');
      }
    }

    // Common dependencies
    const allDeps = new Map<string, number>();
    for (const analysis of fileAnalyses) {
      for (const dep of analysis!.dependencies) {
        if (!dep.startsWith('.')) {
          allDeps.set(dep, (allDeps.get(dep) || 0) + 1);
        }
      }
    }

    if (allDeps.size > 0) {
      lines.push('## Common Dependencies');
      const sortedDeps = Array.from(allDeps.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      for (const [dep, count] of sortedDeps) {
        lines.push(`- \`${dep}\` (used in ${count} files)`);
      }
      lines.push('');
    }

    // Purpose inference
    lines.push('## Purpose');
    const purpose = inferFolderPurpose(folderPath, fileAnalyses as any[]);
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
          text: `Error analyzing folder: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Get folder structure (first level only)
 */
function getFolderStructure(folderPath: string): string[] {
  const items: string[] = [];

  try {
    const entries = readdirSync(folderPath);

    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;

      const fullPath = join(folderPath, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        items.push(`- 📁 ${entry}/`);
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        items.push(`- 📄 ${entry}`);
      }
    }
  } catch {
    // Ignore errors
  }

  return items;
}

/**
 * Infer folder purpose based on structure and files
 */
function inferFolderPurpose(folderPath: string, analyses: any[]): string {
  const folderName = folderPath.split('/').pop() || folderPath.split('\\').pop() || '';

  // Check for common patterns
  const hasTests = analyses.some((a) => a.filePath.includes('.test.') || a.filePath.includes('.spec.'));
  const hasComponents = folderName.includes('component') || analyses.some((a) =>
    a.dependencies.some((d: string) => d === 'react')
  );
  const hasRoutes = folderName.includes('route') || folderName.includes('api');
  const hasUtils = folderName.includes('util') || folderName.includes('helper');
  const hasTypes = folderName.includes('type') || analyses.every((a) =>
    a.parsedFile.symbols.every((s: any) => s.kind === 'interface' || s.kind === 'type')
  );
  const hasServices = folderName.includes('service');
  const hasModels = folderName.includes('model') || folderName.includes('schema');

  if (hasTests) {
    return 'This folder contains test files for the codebase.';
  }

  if (hasComponents) {
    return 'This folder contains React components for the UI.';
  }

  if (hasRoutes) {
    return 'This folder defines API routes or HTTP endpoints.';
  }

  if (hasTypes) {
    return 'This folder contains TypeScript type definitions and interfaces.';
  }

  if (hasServices) {
    return 'This folder contains service classes that implement business logic.';
  }

  if (hasModels) {
    return 'This folder defines data models and schemas.';
  }

  if (hasUtils) {
    return 'This folder contains utility functions and helpers.';
  }

  if (folderName === 'src') {
    return 'This is the main source code directory.';
  }

  return `This folder is part of the ${folderName} module.`;
}
