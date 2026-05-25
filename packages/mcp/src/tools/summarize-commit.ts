import { ProjectAnalyzer } from '@livingdocs/core';
import { resolve } from 'path';
import { execSync } from 'child_process';
import * as z from 'zod';

export const summarizeCommitSchema = z.object({
  commitHash: z.string().optional().describe('Git commit hash to summarize (defaults to HEAD)'),
  projectRoot: z.string().optional().describe('Project root directory (defaults to current directory)'),
});

export type SummarizeCommitInput = z.infer<typeof summarizeCommitSchema>;

/**
 * Summarize what a commit changed architecturally
 */
export async function summarizeCommit(input: SummarizeCommitInput) {
  const { commitHash = 'HEAD', projectRoot = process.cwd() } = input;
  const absoluteRoot = resolve(projectRoot);

  try {
    // Get commit info
    const commitInfo = execSync(
      `git -C "${absoluteRoot}" show --no-patch --format="%H%n%an%n%ae%n%ad%n%s%n%b" ${commitHash}`,
      { encoding: 'utf-8' }
    );

    const [hash, author, email, date, subject, ...bodyLines] = commitInfo.trim().split('\n');
    const body = bodyLines.join('\n').trim();

    // Get changed files
    const diffOutput = execSync(
      `git -C "${absoluteRoot}" diff --name-status ${commitHash}^..${commitHash}`,
      { encoding: 'utf-8' }
    );

    const changes = parseDiffOutput(diffOutput);

    const lines: string[] = [];
    lines.push(`# Commit Summary: ${commitHash.slice(0, 8)}`);
    lines.push('');

    // Commit metadata
    lines.push('## Commit Info');
    lines.push(`- Hash: \`${hash}\``);
    lines.push(`- Author: ${author} <${email}>`);
    lines.push(`- Date: ${date}`);
    lines.push(`- Subject: ${subject}`);
    if (body) {
      lines.push('');
      lines.push('### Description');
      lines.push(body);
    }
    lines.push('');

    // File changes summary
    lines.push('## Changes Summary');
    lines.push(`- Files added: ${changes.added.length}`);
    lines.push(`- Files modified: ${changes.modified.length}`);
    lines.push(`- Files deleted: ${changes.deleted.length}`);
    lines.push(`- Files renamed: ${changes.renamed.length}`);
    lines.push('');

    // Categorize changes
    const categories = categorizeChanges(changes);

    if (Object.keys(categories).length > 0) {
      lines.push('## Changes by Category');
      for (const [category, files] of Object.entries(categories)) {
        lines.push(`### ${category}`);
        for (const file of files) {
          lines.push(`- \`${file}\``);
        }
        lines.push('');
      }
    }

    // Analyze changed TypeScript files
    const tsFiles = [
      ...changes.added.filter(isTypeScriptFile),
      ...changes.modified.filter(isTypeScriptFile),
    ];

    if (tsFiles.length > 0) {
      lines.push('## Architectural Impact');
      const analyzer = new ProjectAnalyzer();

      for (const file of tsFiles.slice(0, 5)) {
        const filePath = resolve(absoluteRoot, file);
        try {
          const analysis = analyzer.analyzeFile(filePath);
          const relativePath = file;

          lines.push(`### ${relativePath}`);
          lines.push(`- Exports: ${analysis.metrics.exportCount}`);
          lines.push(`- Imports: ${analysis.metrics.importCount}`);
          lines.push(`- Symbols: ${analysis.metrics.symbolCount}`);

          if (analysis.parsedFile.symbols.length > 0) {
            const exported = analysis.parsedFile.symbols.filter((s) => s.exported);
            if (exported.length > 0) {
              lines.push(`- Key exports: ${exported.map((s) => s.name).join(', ')}`);
            }
          }
          lines.push('');
        } catch {
          // Skip files that can't be analyzed
        }
      }

      if (tsFiles.length > 5) {
        lines.push(`_... and ${tsFiles.length - 5} more TypeScript files_`);
        lines.push('');
      }
    }

    // Impact assessment
    lines.push('## Impact Assessment');
    const impact = assessCommitImpact(changes);
    for (const item of impact) {
      lines.push(`- ${item}`);
    }

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
          text: `Error summarizing commit: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Parse git diff output
 */
function parseDiffOutput(output: string): {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: string[];
} {
  const changes = {
    added: [] as string[],
    modified: [] as string[],
    deleted: [] as string[],
    renamed: [] as string[],
  };

  const lines = output.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    const [status, ...fileParts] = line.split('\t');
    const file = fileParts.join('\t');

    if (status === 'A') {
      changes.added.push(file);
    } else if (status === 'M') {
      changes.modified.push(file);
    } else if (status === 'D') {
      changes.deleted.push(file);
    } else if (status.startsWith('R')) {
      changes.renamed.push(file);
    }
  }

  return changes;
}

/**
 * Check if file is TypeScript
 */
function isTypeScriptFile(file: string): boolean {
  return file.endsWith('.ts') || file.endsWith('.tsx');
}

/**
 * Categorize changes by type
 */
function categorizeChanges(changes: {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: string[];
}): Record<string, string[]> {
  const categories: Record<string, string[]> = {};

  const allFiles = [
    ...changes.added.map((f) => ({ file: f, type: 'added' })),
    ...changes.modified.map((f) => ({ file: f, type: 'modified' })),
    ...changes.deleted.map((f) => ({ file: f, type: 'deleted' })),
  ];

  for (const { file, type } of allFiles) {
    let category = 'Other';

    if (file.includes('/test/') || file.includes('.test.') || file.includes('.spec.')) {
      category = 'Tests';
    } else if (file.includes('/components/') || file.endsWith('.tsx')) {
      category = 'UI Components';
    } else if (file.includes('/api/') || file.includes('/routes/')) {
      category = 'API/Routes';
    } else if (file.includes('/types/') || file.includes('/interfaces/')) {
      category = 'Types';
    } else if (file.includes('/utils/') || file.includes('/helpers/')) {
      category = 'Utilities';
    } else if (file.includes('/services/')) {
      category = 'Services';
    } else if (file.includes('/models/') || file.includes('/schemas/')) {
      category = 'Models/Schemas';
    } else if (file.endsWith('.md') || file.endsWith('.mdx')) {
      category = 'Documentation';
    } else if (file.includes('package.json') || file.includes('tsconfig.json')) {
      category = 'Configuration';
    }

    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(`[${type}] ${file}`);
  }

  return categories;
}

/**
 * Assess the impact of the commit
 */
function assessCommitImpact(changes: {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: string[];
}): string[] {
  const impact: string[] = [];

  const totalChanges = changes.added.length + changes.modified.length + changes.deleted.length;

  if (totalChanges > 20) {
    impact.push('Large commit with many file changes - consider breaking into smaller commits');
  }

  if (changes.deleted.length > 5) {
    impact.push('Significant code deletion - verify no breaking changes');
  }

  const hasConfigChanges = [...changes.added, ...changes.modified].some((f) =>
    f.includes('package.json') || f.includes('tsconfig.json') || f.includes('.config.')
  );
  if (hasConfigChanges) {
    impact.push('Configuration changes detected - may affect build or dependencies');
  }

  const hasApiChanges = [...changes.added, ...changes.modified].some((f) =>
    f.includes('/api/') || f.includes('/routes/')
  );
  if (hasApiChanges) {
    impact.push('API changes detected - verify backward compatibility');
  }

  const hasTestChanges = [...changes.added, ...changes.modified].some((f) =>
    f.includes('.test.') || f.includes('.spec.')
  );
  if (hasTestChanges) {
    impact.push('Test files modified - run test suite to verify');
  }

  if (impact.length === 0) {
    impact.push('Standard code changes - follow normal review process');
  }

  return impact;
}
