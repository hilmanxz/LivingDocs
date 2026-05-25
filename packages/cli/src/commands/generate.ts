import type { CommandHandler, GenerateOptions } from '../types.js';
import { createLogger } from '../logger.js';
import { ArchitectureGraph } from '@livingdocs/core';
import {
  generateReadme,
  generateArchitecture,
  generateOnboarding,
  generateApiDocs,
  generateDependencyDiagram,
  generateServiceMap,
} from '@livingdocs/engine';
import type { ReadmeData, ArchitectureData, OnboardingData, ApiDocsData } from '@livingdocs/shared';
import { resolve } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';

/**
 * Generate documentation from the current codebase state.
 *
 * This command creates markdown files, diagrams, and guides
 * based on the architecture graph and semantic index.
 */
export const generate: CommandHandler<GenerateOptions> = async (options) => {
  const logger = createLogger(options);

  logger.header('Generating Documentation');

  const projectRoot = options.path || process.cwd();
  const graphPath = resolve(projectRoot, '.livingdocs', 'graph.json');
  const outputDir = options.output || resolve(projectRoot, 'docs', 'living');

  try {
    // Load graph
    logger.info('Loading architecture graph...');
    const graph = await ArchitectureGraph.loadFromFile(graphPath);
    const serialized = graph.toJSON();

    // Create output directory
    await mkdir(outputDir, { recursive: true });

    // Generate README
    logger.info('Generating README.md...');
    const readmeData: ReadmeData = {
      project: {
        name: 'Project',
        description: 'A TypeScript project analyzed by LivingDocs.',
        rootPath: projectRoot,
      },
      architecture: {
        summary: 'This project is organized into modules with clear separation of concerns.',
        keyModules: serialized.nodes
          .filter(n => n.type === 'module')
          .slice(0, 5)
          .map(n => ({
            name: n.name,
            path: n.path || '',
            purpose: `Module for ${n.name}`,
            fileCount: serialized.nodes.filter(f => f.path?.startsWith(n.path || '')).length,
          })),
      },
      gettingStarted: {
        prerequisites: ['Node.js >= 18', 'pnpm or npm'],
        setupSteps: ['Clone the repository', 'Run pnpm install', 'Run pnpm dev'],
      },
      graph: serialized,
    };

    const readmeContent = generateReadme(readmeData);
    await writeFile(resolve(outputDir, 'README.md'), readmeContent, 'utf-8');
    logger.success('✓ README.md generated');

    // Generate Architecture
    logger.info('Generating architecture.md...');
    const dependencyDiagram = generateDependencyDiagram(serialized);
    const serviceMap = generateServiceMap(serialized);

    const architectureData: ArchitectureData = {
      project: { name: 'Project', rootPath: projectRoot },
      overview: 'This project follows a modular architecture with clear dependencies.',
      modules: serialized.nodes
        .filter(n => n.type === 'module')
        .slice(0, 5)
        .map(n => ({
          name: n.name,
          path: n.path || '',
          purpose: `Module for ${n.name}`,
          fileCount: serialized.nodes.filter(f => f.path?.startsWith(n.path || '')).length,
          dependencies: serialized.edges
            .filter(e => e.source === n.id)
            .map(e => serialized.nodes.find(node => node.id === e.target)?.name || '')
            .filter(Boolean),
        })),
      diagrams: {
        dependency: dependencyDiagram,
        serviceMap,
      },
      graph: serialized,
    };

    const architectureContent = generateArchitecture(architectureData);
    await writeFile(resolve(outputDir, 'architecture.md'), architectureContent, 'utf-8');
    logger.success('✓ architecture.md generated');

    // Generate Onboarding
    logger.info('Generating onboarding.md...');
    const onboardingData: OnboardingData = {
      project: {
        name: 'Project',
        description: 'A TypeScript project analyzed by LivingDocs.',
      },
      dayOneGuide: {
        overview: 'Welcome to the project! This guide will help you get started.',
        setupSteps: ['Clone the repository', 'Run pnpm install', 'Run pnpm dev'],
        firstTasks: ['Read the architecture documentation', 'Run the test suite', 'Explore the main modules'],
      },
      criticalFiles: serialized.nodes
        .filter(n => n.type === 'file')
        .slice(0, 5)
        .map((n, i) => ({
          path: n.path || n.name,
          purpose: `Key file: ${n.name}`,
          priority: i === 0 ? 'high' : i < 3 ? 'medium' : 'low' as const,
        })),
      glossary: [
        { term: 'Module', definition: 'A logical grouping of related functionality' },
        { term: 'Service', definition: 'A core business logic component' },
        { term: 'Route', definition: 'An API endpoint or page route' },
      ],
      graph: serialized,
    };

    const onboardingContent = generateOnboarding(onboardingData);
    await writeFile(resolve(outputDir, 'onboarding.md'), onboardingContent, 'utf-8');
    logger.success('✓ onboarding.md generated');

    // Generate API docs if routes exist
    const routes = serialized.nodes.filter(n => n.type === 'route');
    if (routes.length > 0) {
      logger.info('Generating API documentation...');
      const apiData: ApiDocsData = {
        project: { name: 'Project' },
        routes: routes.map(r => ({
          method: 'GET' as const,
          path: r.name,
          handler: 'handler',
          description: `Endpoint: ${r.name}`,
          framework: 'express' as const,
        })),
        graph: serialized,
      };

      const apiContent = generateApiDocs(apiData);
      await writeFile(resolve(outputDir, 'api.md'), apiContent, 'utf-8');
      logger.success('✓ api.md generated');
    }

    // Save diagrams
    logger.info('Saving diagrams...');
    const diagramsDir = resolve(outputDir, 'diagrams');
    await mkdir(diagramsDir, { recursive: true });

    await writeFile(
      resolve(diagramsDir, 'dependency-graph.md'),
      `# Dependency Graph\n\n\`\`\`mermaid\n${dependencyDiagram}\n\`\`\``,
      'utf-8'
    );

    await writeFile(
      resolve(diagramsDir, 'service-map.md'),
      `# Service Map\n\n\`\`\`mermaid\n${serviceMap}\n\`\`\``,
      'utf-8'
    );

    logger.success('✓ Diagrams saved');

    if (options.json) {
      logger.json({
        status: 'success',
        outputDir,
        files: {
          readme: 'README.md',
          architecture: 'architecture.md',
          onboarding: 'onboarding.md',
          api: routes.length > 0 ? 'api.md' : null,
          diagrams: ['diagrams/dependency-graph.md', 'diagrams/service-map.md'],
        },
      });
    } else {
      logger.success('\n✓ Documentation generated successfully!');
      logger.info(`\nOutput directory: ${outputDir}`);
      logger.info('\nGenerated files:');
      logger.info('  • README.md');
      logger.info('  • architecture.md');
      logger.info('  • onboarding.md');
      if (routes.length > 0) {
        logger.info('  • api.md');
      }
      logger.info('  • diagrams/');
    }
  } catch (error) {
    if (options.json) {
      logger.json({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      logger.error(`\nGeneration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  }
};
