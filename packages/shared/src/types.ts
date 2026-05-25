/**
 * Graph node types representing different entities in the codebase
 */
export type NodeType = 'file' | 'module' | 'function' | 'class' | 'interface' | 'route' | 'schema' | 'service';

/**
 * Edge relationship types
 */
export type EdgeType = 'imports' | 'calls' | 'extends' | 'implements' | 'depends_on' | 'http_route' | 'event_emits' | 'event_listens';

/**
 * Represents a node in the architecture graph
 */
export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  path?: string; // File path for file/module nodes
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Represents an edge (relationship) between two nodes
 */
export interface GraphEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  type: EdgeType;
  metadata?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Complete graph structure
 */
export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  metadata?: {
    version?: string;
    createdAt?: number;
    updatedAt?: number;
    projectRoot?: string;
  };
}

/**
 * Serializable graph format (for JSON)
 */
export interface SerializedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: Graph['metadata'];
}

/**
 * Graph diff showing changes between two graphs
 */
export interface GraphDiff {
  addedNodes: GraphNode[];
  removedNodes: GraphNode[];
  modifiedNodes: Array<{
    before: GraphNode;
    after: GraphNode;
  }>;
  addedEdges: GraphEdge[];
  removedEdges: GraphEdge[];
  modifiedEdges: Array<{
    before: GraphEdge;
    after: GraphEdge;
  }>;
}

/**
 * Circular dependency information
 */
export interface CircularDependency {
  cycle: string[]; // Array of node IDs forming the cycle
  edges: GraphEdge[];
}

/**
 * Path finding result
 */
export interface PathResult {
  found: boolean;
  path: string[]; // Array of node IDs
  distance: number;
}

/**
 * Neighbor query result
 */
export interface NeighborResult {
  incoming: GraphNode[]; // Nodes that point to this node
  outgoing: GraphNode[]; // Nodes this node points to
}

/**
 * Parser-specific types for static analysis
 */

/**
 * Represents a parsed TypeScript file
 */
export interface FileNode {
  path: string;
  absolutePath: string;
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  symbols: Symbol[];
  routes?: RouteInfo[];
  dependencies: Dependency[];
  ast?: unknown; // Tree-sitter AST node
}

/**
 * Import declaration in a file
 */
export interface ImportDeclaration {
  source: string; // Module path
  specifiers: ImportSpecifier[];
  isTypeOnly: boolean;
  location: SourceLocation;
}

/**
 * Import specifier (named, default, namespace)
 */
export interface ImportSpecifier {
  type: 'named' | 'default' | 'namespace';
  name: string;
  alias?: string;
}

/**
 * Export declaration in a file
 */
export interface ExportDeclaration {
  type: 'named' | 'default' | 'all';
  name?: string;
  source?: string; // Re-export source
  location: SourceLocation;
}

/**
 * Symbol (function, class, interface, type, variable)
 */
export interface Symbol {
  name: string;
  kind: SymbolKind;
  exported: boolean;
  location: SourceLocation;
  signature?: string;
  documentation?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Symbol kinds
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'const'
  | 'enum'
  | 'namespace';

/**
 * Route information (Express, Next.js, NestJS)
 */
export interface RouteInfo {
  method: HttpMethod;
  path: string;
  handler: string; // Function name
  framework: 'express' | 'nextjs' | 'nestjs' | 'fastify';
  location: SourceLocation;
  middleware?: string[];
}

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

/**
 * Dependency between files
 */
export interface Dependency {
  from: string; // File path
  to: string; // File path or module name
  type: DependencyType;
  specifiers: string[]; // What is imported
}

/**
 * Dependency types
 */
export type DependencyType = 'import' | 'dynamic-import' | 'require' | 'type-import';

/**
 * Source code location
 */
export interface SourceLocation {
  start: Position;
  end: Position;
}

/**
 * Position in source code
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * Parser API types
 */

/**
 * Type aliases for cleaner parser API
 */
export type Import = ImportDeclaration;
export type Export = ExportDeclaration;

/**
 * Parsed file result from TypeScriptParser
 */
export interface ParsedFile {
  filePath: string;
  content: string;
  imports: Import[];
  exports: Export[];
  symbols: Symbol[];
  lineCount: number;
}

/**
 * File analysis result from ProjectAnalyzer
 */
export interface FileAnalysis {
  filePath: string;
  absolutePath: string;
  parsedFile: ParsedFile;
  dependencies: string[];
  metrics: {
    importCount: number;
    exportCount: number;
    symbolCount: number;
    lineCount: number;
  };
  errors?: string[];
}

/**
 * Semantic layer types
 */

/**
 * LLM provider configuration
 */
export type LLMProvider = 'openai' | 'anthropic';

/**
 * LLM configuration
 */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * LLM completion request
 */
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * LLM completion response
 */
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * File summary generated by LLM
 */
export interface FileSummary {
  filePath: string;
  summary: string;
  purpose: string;
  keyExports: string[];
  dependencies: string[];
  generatedAt: number;
}

/**
 * Folder summary generated by LLM
 */
export interface FolderSummary {
  folderPath: string;
  summary: string;
  purpose: string;
  fileCount: number;
  keyFiles: string[];
  generatedAt: number;
}

/**
 * Module summary generated by LLM
 */
export interface ModuleSummary {
  moduleName: string;
  summary: string;
  purpose: string;
  fileCount: number;
  keyFiles: string[];
  generatedAt: number;
}

/**
 * Context for LLM prompts
 */
export interface LLMContext {
  files: Array<{
    path: string;
    content: string;
    summary?: string;
  }>;
  symbols: Symbol[];
  dependencies: Dependency[];
  metadata?: Record<string, unknown>;
}

/**
 * Embedding vector
 */
export interface Embedding {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Similarity search result
 */
export interface SimilarityResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Documentation template data types
 */

/**
 * Data for README.md generation
 */
export interface ReadmeData {
  project: {
    name: string;
    description: string;
    rootPath: string;
  };
  architecture: {
    summary: string;
    keyModules: Array<{
      name: string;
      path: string;
      purpose: string;
      fileCount: number;
    }>;
  };
  gettingStarted: {
    setupSteps: string[];
    prerequisites: string[];
  };
  graph: SerializedGraph;
}

/**
 * Data for architecture.md generation
 */
export interface ArchitectureData {
  project: {
    name: string;
    rootPath: string;
  };
  overview: string;
  modules: Array<{
    name: string;
    path: string;
    purpose: string;
    fileCount: number;
    dependencies: string[];
  }>;
  diagrams: {
    dependency: string; // Mermaid diagram
    serviceMap: string; // Mermaid diagram
  };
  graph: SerializedGraph;
}

/**
 * Data for onboarding.md generation
 */
export interface OnboardingData {
  project: {
    name: string;
    description: string;
  };
  dayOneGuide: {
    overview: string;
    setupSteps: string[];
    firstTasks: string[];
  };
  criticalFiles: Array<{
    path: string;
    purpose: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  glossary: Array<{
    term: string;
    definition: string;
  }>;
  graph: SerializedGraph;
}

/**
 * Data for API documentation generation
 */
export interface ApiDocsData {
  project: {
    name: string;
  };
  routes: Array<{
    method: HttpMethod;
    path: string;
    handler: string;
    description: string;
    requestSchema?: string;
    responseSchema?: string;
    middleware?: string[];
    framework: 'express' | 'nextjs' | 'nestjs' | 'fastify';
  }>;
  graph: SerializedGraph;
}

/**
 * Change analysis types for PR/Commit summarization
 */

/**
 * Represents a single file diff
 */
export interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  oldPath?: string; // For renamed files
}

/**
 * Represents a hunk (section) of changes in a diff
 */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

/**
 * Summary of changes from a diff
 */
export interface ChangeSummary {
  overview: string;
  structuralChanges: string[];
  affectedModules: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Impact analysis report
 */
export interface ImpactReport {
  directlyAffected: string[];
  potentiallyAffected: string[];
  regressionZones: string[];
  riskAssessment: string;
}

/**
 * Query layer types for natural language questions
 */

/**
 * Question type classification
 */
export type QuestionType = 'why' | 'how' | 'what' | 'where' | 'impact' | 'dependency';

/**
 * Result from a natural language query
 */
export interface QueryResult {
  answer: string;
  confidence: number;
  sources: Array<{ path: string; relevance: number }>;
  relatedNodes: GraphNode[];
}
