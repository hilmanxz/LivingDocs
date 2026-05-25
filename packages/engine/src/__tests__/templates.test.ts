import { describe, it, expect } from 'vitest';
import { generateReadme } from '../templates/readme.js';
import { generateArchitecture } from '../templates/architecture.js';
import { generateOnboarding } from '../templates/onboarding.js';
import { generateApiDocs } from '../templates/api.js';
import { generateDependencyDiagram, generateServiceMap } from '../templates/mermaid.js';
import type { ReadmeData, ArchitectureData, OnboardingData, ApiDocsData, SerializedGraph } from '@livingdocs/shared';

const sampleGraph: SerializedGraph = {
  nodes: [
    { id: 'file-1', type: 'file', name: 'index.ts', path: 'src/index.ts' },
    { id: 'file-2', type: 'file', name: 'auth.ts', path: 'src/auth.ts' },
    { id: 'module-1', type: 'module', name: 'auth', path: 'src/auth/' },
    { id: 'service-1', type: 'service', name: 'AuthService' },
    { id: 'route-1', type: 'route', name: 'POST /login' },
  ],
  edges: [
    { id: 'e1', source: 'file-1', target: 'file-2', type: 'imports' },
    { id: 'e2', source: 'route-1', target: 'service-1', type: 'calls' },
  ],
  metadata: { version: '1.0.0', createdAt: Date.now(), updatedAt: Date.now() },
};

describe('generateReadme', () => {
  const data: ReadmeData = {
    project: {
      name: 'MyApp',
      description: 'A sample application for testing.',
      rootPath: '/project',
    },
    architecture: {
      summary: 'This is a modular TypeScript application with authentication and API layers.',
      keyModules: [
        { name: 'Auth', path: 'src/auth/', purpose: 'Handles user authentication and session management.', fileCount: 5 },
        { name: 'API', path: 'src/api/', purpose: 'REST API endpoints for the application.', fileCount: 8 },
      ],
    },
    gettingStarted: {
      prerequisites: ['Node.js >= 18', 'pnpm'],
      setupSteps: ['Clone the repository', 'Run `pnpm install`', 'Run `pnpm dev`'],
    },
    graph: sampleGraph,
  };

  it('should generate a valid README with project name', () => {
    const result = generateReadme(data);
    expect(result).toContain('# MyApp');
  });

  it('should include architecture summary', () => {
    const result = generateReadme(data);
    expect(result).toContain('modular TypeScript application');
  });

  it('should include key modules', () => {
    const result = generateReadme(data);
    expect(result).toContain('### Auth');
    expect(result).toContain('### API');
  });

  it('should include prerequisites', () => {
    const result = generateReadme(data);
    expect(result).toContain('Node.js >= 18');
    expect(result).toContain('pnpm');
  });

  it('should include setup steps', () => {
    const result = generateReadme(data);
    expect(result).toContain('1. Clone the repository');
    expect(result).toContain('2. Run `pnpm install`');
  });

  it('should include project statistics', () => {
    const result = generateReadme(data);
    expect(result).toContain('**Total Files:** 2');
  });

  it('should include LivingDocs footer', () => {
    const result = generateReadme(data);
    expect(result).toContain('LivingDocs');
  });
});

describe('generateArchitecture', () => {
  const data: ArchitectureData = {
    project: { name: 'MyApp', rootPath: '/project' },
    overview: 'MyApp is built with a layered architecture separating concerns into modules.',
    modules: [
      {
        name: 'Auth',
        path: 'src/auth/',
        purpose: 'Authentication and authorization logic.',
        fileCount: 5,
        dependencies: ['database', 'crypto'],
      },
    ],
    diagrams: {
      dependency: 'graph TD\n  A --> B',
      serviceMap: 'graph LR\n  Auth --> DB',
    },
    graph: sampleGraph,
  };

  it('should generate architecture doc with project name', () => {
    const result = generateArchitecture(data);
    expect(result).toContain('# MyApp - Architecture Documentation');
  });

  it('should include system overview', () => {
    const result = generateArchitecture(data);
    expect(result).toContain('layered architecture');
  });

  it('should include mermaid diagrams', () => {
    const result = generateArchitecture(data);
    expect(result).toContain('```mermaid');
    expect(result).toContain('graph TD');
  });

  it('should include module breakdown', () => {
    const result = generateArchitecture(data);
    expect(result).toContain('### Auth');
    expect(result).toContain('Authentication and authorization logic.');
  });

  it('should include module dependencies', () => {
    const result = generateArchitecture(data);
    expect(result).toContain('`database`');
    expect(result).toContain('`crypto`');
  });
});

describe('generateOnboarding', () => {
  const data: OnboardingData = {
    project: { name: 'MyApp', description: 'A sample app.' },
    dayOneGuide: {
      overview: 'MyApp is a REST API serving mobile and web clients.',
      setupSteps: ['Install dependencies', 'Setup database', 'Run dev server'],
      firstTasks: ['Read the auth module', 'Run the test suite'],
    },
    criticalFiles: [
      { path: 'src/index.ts', purpose: 'Application entry point.', priority: 'high' },
      { path: 'src/config.ts', purpose: 'Configuration management.', priority: 'medium' },
    ],
    glossary: [
      { term: 'JWT', definition: 'JSON Web Token used for authentication.' },
      { term: 'ORM', definition: 'Object-Relational Mapping for database access.' },
    ],
    graph: sampleGraph,
  };

  it('should generate onboarding guide with project name', () => {
    const result = generateOnboarding(data);
    expect(result).toContain('# MyApp - Developer Onboarding Guide');
  });

  it('should include day one overview', () => {
    const result = generateOnboarding(data);
    expect(result).toContain('REST API serving mobile and web clients');
  });

  it('should include setup steps', () => {
    const result = generateOnboarding(data);
    expect(result).toContain('1. Install dependencies');
  });

  it('should include first tasks as checkboxes', () => {
    const result = generateOnboarding(data);
    expect(result).toContain('- [ ] Read the auth module');
  });

  it('should sort critical files by priority', () => {
    const result = generateOnboarding(data);
    const indexPos = result.indexOf('src/index.ts');
    const configPos = result.indexOf('src/config.ts');
    expect(indexPos).toBeLessThan(configPos);
  });

  it('should include glossary', () => {
    const result = generateOnboarding(data);
    expect(result).toContain('**JWT:**');
    expect(result).toContain('JSON Web Token');
  });
});

describe('generateApiDocs', () => {
  const data: ApiDocsData = {
    project: { name: 'MyApp' },
    routes: [
      {
        method: 'POST',
        path: '/api/auth/login',
        handler: 'loginHandler',
        description: 'Authenticate user and return JWT token.',
        requestSchema: '{ email: string; password: string }',
        responseSchema: '{ token: string; expiresIn: number }',
        middleware: ['rateLimit', 'validateBody'],
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/api/users',
        handler: 'listUsers',
        description: 'List all users with pagination.',
        framework: 'express',
      },
    ],
    graph: sampleGraph,
  };

  it('should generate API docs with project name', () => {
    const result = generateApiDocs(data);
    expect(result).toContain('# MyApp - API Documentation');
  });

  it('should include route paths', () => {
    const result = generateApiDocs(data);
    expect(result).toContain('/api/auth/login');
    expect(result).toContain('/api/users');
  });

  it('should include HTTP methods', () => {
    const result = generateApiDocs(data);
    expect(result).toContain('POST');
    expect(result).toContain('GET');
  });

  it('should include request/response schemas', () => {
    const result = generateApiDocs(data);
    expect(result).toContain('email: string; password: string');
    expect(result).toContain('token: string; expiresIn: number');
  });

  it('should include middleware', () => {
    const result = generateApiDocs(data);
    expect(result).toContain('`rateLimit`');
    expect(result).toContain('`validateBody`');
  });

  it('should include summary with total endpoints', () => {
    const result = generateApiDocs(data);
    expect(result).toContain('**Total Endpoints:** 2');
  });
});

describe('generateDependencyDiagram', () => {
  it('should generate valid mermaid graph', () => {
    const result = generateDependencyDiagram(sampleGraph);
    expect(result).toContain('graph TD');
  });

  it('should include nodes', () => {
    const result = generateDependencyDiagram(sampleGraph);
    expect(result).toContain('index.ts');
    expect(result).toContain('auth.ts');
  });

  it('should include edges', () => {
    const result = generateDependencyDiagram(sampleGraph);
    expect(result).toContain('file-1 --> file-2');
  });

  it('should use different shapes for node types', () => {
    const result = generateDependencyDiagram(sampleGraph);
    expect(result).toContain('module-1[[auth]]');
    expect(result).toContain('service-1{{AuthService}}');
  });
});

describe('generateServiceMap', () => {
  it('should generate valid mermaid graph', () => {
    const result = generateServiceMap(sampleGraph);
    expect(result).toContain('graph LR');
  });

  it('should include service nodes', () => {
    const result = generateServiceMap(sampleGraph);
    expect(result).toContain('AuthService');
  });

  it('should include route nodes', () => {
    const result = generateServiceMap(sampleGraph);
    expect(result).toContain('POST /login');
  });
});
