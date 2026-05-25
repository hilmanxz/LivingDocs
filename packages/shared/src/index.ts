// Shared types and utilities
export * from './types.js';

export interface ProjectConfig {
  name: string;
  version: string;
  exclude?: string[];
}

export interface AnalysisResult {
  projectName: string;
  filesScanned: number;
  components: string[];
}
