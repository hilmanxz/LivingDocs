import { ProjectAnalyzer } from '@livingdocs/core';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import * as z from 'zod';

export const detectImpactSchema = z.object({
  filePath: z.string().describe('Path to the file being changed'),
});

export type DetectImpactInput = z.infer<typeof detectImpactSchema>;

/**
 * Detect impact of changing a file - returns affected services, APIs, potential regression zones
 */
export async function detectImpact(input: DetectImpactInput) {
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

    // Scan the project from the file's directory upward to find project root
    const projectRoot = findProjectRoot(absolutePath);
    let allFiles: string[] = [];
    let dependents: Array<{ file: string; imports: string[] }> = [];

    if (projectRoot) {
      analyzer.loadProject(projectRoot);
      allFiles = analyzer.getAllFiles();

      // Find files that import the target file
      dependents = findDependents(absolutePath, allFiles, analyzer);
    }

    const lines: string[] = [];
    lines.push(`# Impact Analysis: ${filePath}`);
    lines.push('');

    // What this file exports (the "contract")
    lines.push('## Public Contract');
    const exported = analysis.parsedFile.symbols.filter((s) => s.exported);
    if (exported.length === 0) {
      lines.push('No exported symbols. Changes are likely internal-only.');
    } else {
      lines.push('Changes to these exports may break dependents:');
      for (const symbol of exported) {
        lines.push(`- \`${symbol.name}\` (${symbol.kind})`);
      }
    }
    lines.push('');

    // Direct dependents
    lines.push('## Direct Dependents');
    if (dependents.length === 0) {
      lines.push('No files found that import this file directly.');
    } else {
      lines.push(`${dependents.length} file(s) directly import this file:`);
      for (const dep of dependents) {
        const relativePath = dep.file.replace(projectRoot || '', '.');
        lines.push(`- \`${relativePath}\``);
        if (dep.imports.length > 0) {
          lines.push(`  Uses: ${dep.imports.join(', ')}`);
        }
      }
    }
    lines.push('');

    // Risk assessment
    lines.push('## Risk Assessment');
    const risk = assessRisk(analysis, dependents, exported);
    lines.push(`- Impact level: **${risk.level}**`);
    lines.push(`- Reason: ${risk.reason}`);
    lines.push('');

    // Potential regression zones
    lines.push('## Potential Regression Zones');
    const zones = identifyRegressionZones(absolutePath, dependents, analysis);
    if (zones.length === 0) {
      lines.push('No specific regression zones identified.');
    } else {
      for (const zone of zones) {
        lines.push(`- ${zone}`);
      }
    }
    lines.push('');

    // Recommendations
    lines.push('## Recommendations');
    const recommendations = generateRecommendations(risk, dependents, exported);
    for (const rec of recommendations) {
      lines.push(`- ${rec}`);
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
          text: `Error detecting impact: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Find the project root by looking for package.json
 */
function findProjectRoot(filePath: string): string | null {
  let dir = dirname(filePath);
  const root = resolve('/');

  while (dir !== root) {
    if (existsSync(resolve(dir, 'package.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }

  return null;
}

/**
 * Find files that depend on the target file
 */
function findDependents(
  targetPath: string,
  allFiles: string[],
  analyzer: ProjectAnalyzer
): Array<{ file: string; imports: string[] }> {
  const dependents: Array<{ file: string; imports: string[] }> = [];
  const targetBaseName = targetPath.replace(/\.(ts|tsx|js|jsx)$/, '');

  for (const file of allFiles) {
    if (file === targetPath) continue;

    try {
      const fileAnalysis = analyzer.analyzeFile(file);
      const matchingImports = fileAnalysis.parsedFile.imports.filter((imp) => {
        const resolvedImport = resolve(dirname(file), imp.source);
        const resolvedBase = resolvedImport.replace(/\.(ts|tsx|js|jsx)$/, '');
        return resolvedBase === targetBaseName || resolvedImport === targetPath;
      });

      if (matchingImports.length > 0) {
        const importedNames = matchingImports.flatMap((imp) =>
          imp.specifiers.map((s) => s.name)
        );
        dependents.push({ file, imports: importedNames });
      }
    } catch {
      // Skip files that can't be analyzed
    }
  }

  return dependents;
}

/**
 * Assess the risk level of changing this file
 */
function assessRisk(
  analysis: any,
  dependents: Array<{ file: string; imports: string[] }>,
  exported: any[]
): { level: string; reason: string } {
  if (exported.length === 0) {
    return { level: 'Low', reason: 'No exported symbols; changes are internal only.' };
  }

  if (dependents.length === 0) {
    return { level: 'Low', reason: 'No dependents found; file is a leaf node.' };
  }

  if (dependents.length > 5) {
    return { level: 'High', reason: `${dependents.length} files depend on this; changes have wide blast radius.` };
  }

  if (dependents.length > 2) {
    return { level: 'Medium', reason: `${dependents.length} files depend on this; moderate blast radius.` };
  }

  return { level: 'Low', reason: 'Few dependents; limited blast radius.' };
}

/**
 * Identify potential regression zones
 */
function identifyRegressionZones(
  filePath: string,
  dependents: Array<{ file: string; imports: string[] }>,
  analysis: any
): string[] {
  const zones: string[] = [];

  // Check if file is in a critical path
  if (filePath.includes('/api/') || filePath.includes('/routes/')) {
    zones.push('API endpoints may be affected - test HTTP responses');
  }

  if (filePath.includes('/auth/') || filePath.includes('/security/')) {
    zones.push('Security-critical code - thorough review required');
  }

  if (filePath.includes('/middleware/')) {
    zones.push('Middleware changes affect all routes using it');
  }

  // Check dependent patterns
  const testDependents = dependents.filter((d) =>
    d.file.includes('.test.') || d.file.includes('.spec.')
  );
  if (testDependents.length > 0) {
    zones.push(`${testDependents.length} test file(s) directly test this module`);
  }

  const componentDependents = dependents.filter((d) =>
    d.file.includes('/components/') || d.file.includes('.tsx')
  );
  if (componentDependents.length > 0) {
    zones.push(`${componentDependents.length} UI component(s) depend on this`);
  }

  return zones;
}

/**
 * Generate recommendations based on impact analysis
 */
function generateRecommendations(
  risk: { level: string; reason: string },
  dependents: Array<{ file: string; imports: string[] }>,
  exported: any[]
): string[] {
  const recommendations: string[] = [];

  if (risk.level === 'High') {
    recommendations.push('Consider making changes backward-compatible');
    recommendations.push('Run full test suite before merging');
    recommendations.push('Consider a phased rollout');
  }

  if (exported.length > 0) {
    recommendations.push('Verify exported type signatures remain compatible');
  }

  if (dependents.length > 0) {
    recommendations.push(`Update or verify ${dependents.length} dependent file(s)`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Low-risk change; standard review process is sufficient');
  }

  return recommendations;
}
