import {
  generateReadme,
  generateArchitecture,
  generateOnboarding,
  generateApiDocs,
} from '@livingdocs/engine';
import { ProjectAnalyzer, ArchitectureGraph } from '@livingdocs/core';
import { resolve } from 'path';
import { existsSync } from 'fs';
import * as z from 'zod';

export const generateDocsSchema = z.object({
  path: z.string().describe('Path to the project or folder to document'),
  type: z.enum(['readme', 'architecture', 'onboarding', 'api']).describe('Type of documentation to generate'),
});

export type GenerateDocsInput = z.infer<typeof generateDocsSchema>;

/**
 * Generate documentation for a path using engine templates
 */
export async function generateDocs(input: GenerateDocsInput) {
  const { path, type } = input;
  const absolutePath = resolve(path);

  if (!existsSync(absolutePath)) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: Path not found: ${absolutePath}`,
        },
      ],
    };
  }

  try {
    const analyzer = new ProjectAnalyzer();
    analyzer.loadProject(absolutePath);
    const files = analyzer.getAllFiles();

    // Analyze files
    const analyses = files.slice(0, 50).map((file) => {
      try {
        return analyzer.analyzeFile(file);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Build architecture graph
    const graph = new ArchitectureGraph();
    for (const analysis of analyses) {
      if (!analysis) continue;

      // Add file node
      graph.addNode({
        id: analysis.filePath,
        type: 'file',
        name: analysis.filePath.split('/').pop() || analysis.filePath,
        path: analysis.filePath,
      });

      // Add dependency edges
      for (const dep of analysis.dependencies) {
        if (dep.startsWith('.')) {
          const depPath = resolve(analysis.filePath, '..', dep);
          if (graph.hasNode(depPath)) {
            graph.addEdge({
              id: `${analysis.filePath}->${depPath}`,
              source: analysis.filePath,
              target: depPath,
              type: 'imports',
            });
          }
        }
      }
    }

    const serializedGraph = graph.toJSON();

    let documentation = '';

    switch (type) {
      case 'readme': {
        const readmeData = {
          project: {
            name: path.split('/').pop() || 'Project',
            description: 'TypeScript project',
            rootPath: absolutePath,
          },
          architecture: {
            summary: `Project with ${files.length} TypeScript files`,
            keyModules: analyses.slice(0, 5).map((a) => ({
              name: a!.filePath.split('/').pop() || '',
              path: a!.filePath,
              purpose: 'Module',
              fileCount: 1,
            })),
          },
          gettingStarted: {
            setupSteps: [
              'Clone the repository',
              'Install dependencies: `npm install`',
              'Build the project: `npm run build`',
              'Run tests: `npm test`',
            ],
            prerequisites: ['Node.js >= 18', 'npm or pnpm'],
          },
          graph: serializedGraph,
        };
        documentation = await generateReadme(readmeData);
        break;
      }

      case 'architecture': {
        const archData = {
          project: {
            name: path.split('/').pop() || 'Project',
            rootPath: absolutePath,
          },
          overview: `Architecture overview for ${files.length} files`,
          modules: analyses.slice(0, 10).map((a) => ({
            name: a!.filePath.split('/').pop() || '',
            path: a!.filePath,
            purpose: 'Module',
            fileCount: 1,
            dependencies: a!.dependencies,
          })),
          diagrams: {
            dependency: '```mermaid\ngraph TD\n  A[Module A] --> B[Module B]\n```',
            serviceMap: '```mermaid\ngraph LR\n  Service1 --> Service2\n```',
          },
          graph: serializedGraph,
        };
        documentation = await generateArchitecture(archData);
        break;
      }

      case 'onboarding': {
        const onboardingData = {
          project: {
            name: path.split('/').pop() || 'Project',
            description: 'TypeScript project',
          },
          dayOneGuide: {
            overview: 'Welcome to the project!',
            setupSteps: [
              'Clone the repository',
              'Install dependencies',
              'Read the architecture docs',
            ],
            firstTasks: [
              'Run the test suite',
              'Explore the codebase',
              'Pick up a starter issue',
            ],
          },
          criticalFiles: analyses.slice(0, 5).map((a) => ({
            path: a!.filePath,
            purpose: 'Important file',
            priority: 'high' as const,
          })),
          glossary: [
            { term: 'Module', definition: 'A self-contained unit of code' },
            { term: 'Service', definition: 'A class that implements business logic' },
          ],
          graph: serializedGraph,
        };
        documentation = await generateOnboarding(onboardingData);
        break;
      }

      case 'api': {
        // Extract routes from analyses
        const routes: any[] = [];
        for (const analysis of analyses) {
          if (analysis?.parsedFile.symbols) {
            for (const symbol of analysis.parsedFile.symbols) {
              if (symbol.kind === 'function' && symbol.exported) {
                // Simple heuristic: if function name suggests HTTP method
                const name = symbol.name.toLowerCase();
                if (name.startsWith('get') || name.startsWith('post') || name.startsWith('put') || name.startsWith('delete')) {
                  routes.push({
                    method: name.startsWith('get') ? 'GET' : name.startsWith('post') ? 'POST' : name.startsWith('put') ? 'PUT' : 'DELETE',
                    path: `/api/${symbol.name}`,
                    handler: symbol.name,
                    description: `Handler for ${symbol.name}`,
                    framework: 'express' as const,
                  });
                }
              }
            }
          }
        }

        const apiData = {
          project: {
            name: path.split('/').pop() || 'Project',
          },
          routes,
          graph: serializedGraph,
        };
        documentation = await generateApiDocs(apiData);
        break;
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: documentation,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error generating documentation: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
