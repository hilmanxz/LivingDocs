import type { ParsedFile, FileSummary, FolderSummary, ModuleSummary } from '@livingdocs/shared';
import { LLMClient } from './LLMClient.js';
import { ContextBuilder } from './ContextBuilder.js';

/**
 * Summarizer - Generates AI-powered summaries of files, folders, and modules
 */
export class Summarizer {
  private llmClient: LLMClient;
  private contextBuilder: ContextBuilder;

  constructor(llmClient: LLMClient, contextBuilder?: ContextBuilder) {
    this.llmClient = llmClient;
    this.contextBuilder = contextBuilder || new ContextBuilder();
  }

  /**
   * Summarize a single file
   */
  async summarizeFile(filePath: string, parsedFile: ParsedFile): Promise<FileSummary> {
    const context = this.contextBuilder.buildFileContext(filePath, parsedFile);

    const prompt = this.contextBuilder.buildPrompt(
      context,
      `Analyze this TypeScript file and provide:
1. A brief one-sentence summary of what this file does
2. The main purpose of this file in the codebase
3. List of key exports (functions, classes, types)
4. List of external dependencies

Format your response as JSON with keys: summary, purpose, keyExports, dependencies`,
      'Return ONLY valid JSON, no markdown formatting.'
    );

    const response = await this.llmClient.complete({
      prompt,
      systemPrompt: 'You are a code analysis expert. Analyze TypeScript code and provide structured summaries.',
      maxTokens: 1000,
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        filePath,
        summary: parsed.summary || '',
        purpose: parsed.purpose || '',
        keyExports: parsed.keyExports || [],
        dependencies: parsed.dependencies || [],
        generatedAt: Date.now(),
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        filePath,
        summary: response.content.split('\n')[0],
        purpose: response.content,
        keyExports: parsedFile.symbols.filter(s => s.exported).map(s => s.name),
        dependencies: parsedFile.imports.map(i => i.source),
        generatedAt: Date.now(),
      };
    }
  }

  /**
   * Summarize a folder/module
   */
  async summarizeFolder(folderPath: string, parsedFiles: ParsedFile[]): Promise<FolderSummary> {
    const context = this.contextBuilder.buildFolderContext(folderPath, parsedFiles);

    const prompt = this.contextBuilder.buildPrompt(
      context,
      `Analyze this folder/module and provide:
1. A brief one-sentence summary of what this module does
2. The main purpose of this module in the codebase
3. List of key files (most important ones)
4. Overall module responsibility

Format your response as JSON with keys: summary, purpose, keyFiles`,
      'Return ONLY valid JSON, no markdown formatting.'
    );

    const response = await this.llmClient.complete({
      prompt,
      systemPrompt: 'You are a code analysis expert. Analyze TypeScript modules and provide structured summaries.',
      maxTokens: 1000,
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        folderPath,
        summary: parsed.summary || '',
        purpose: parsed.purpose || '',
        fileCount: parsedFiles.length,
        keyFiles: parsed.keyFiles || parsedFiles.slice(0, 3).map(f => f.filePath),
        generatedAt: Date.now(),
      };
    } catch {
      // Fallback
      return {
        folderPath,
        summary: response.content.split('\n')[0],
        purpose: response.content,
        fileCount: parsedFiles.length,
        keyFiles: parsedFiles.slice(0, 3).map(f => f.filePath),
        generatedAt: Date.now(),
      };
    }
  }

  /**
   * Summarize a module with a specific name
   */
  async summarizeModule(moduleName: string, parsedFiles: ParsedFile[]): Promise<ModuleSummary> {
    const context = this.contextBuilder.buildFolderContext(moduleName, parsedFiles);

    const prompt = this.contextBuilder.buildPrompt(
      context,
      `Analyze this module named "${moduleName}" and provide:
1. A brief one-sentence summary
2. The main purpose and responsibility
3. Key files that define the module's interface
4. What other modules depend on this one

Format your response as JSON with keys: summary, purpose, keyFiles`,
      'Return ONLY valid JSON, no markdown formatting.'
    );

    const response = await this.llmClient.complete({
      prompt,
      systemPrompt: 'You are a code analysis expert. Analyze TypeScript modules and provide structured summaries.',
      maxTokens: 1000,
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        moduleName,
        summary: parsed.summary || '',
        purpose: parsed.purpose || '',
        fileCount: parsedFiles.length,
        keyFiles: parsed.keyFiles || parsedFiles.slice(0, 3).map(f => f.filePath),
        generatedAt: Date.now(),
      };
    } catch {
      // Fallback
      return {
        moduleName,
        summary: response.content.split('\n')[0],
        purpose: response.content,
        fileCount: parsedFiles.length,
        keyFiles: parsedFiles.slice(0, 3).map(f => f.filePath),
        generatedAt: Date.now(),
      };
    }
  }

  /**
   * Generate a project overview summary
   */
  async summarizeProject(
    projectName: string,
    description: string,
    parsedFiles: ParsedFile[]
  ): Promise<string> {
    // Use a subset of files for project overview
    const sampleFiles = parsedFiles.slice(0, 5);
    const context = this.contextBuilder.buildFolderContext(projectName, sampleFiles);

    const prompt = this.contextBuilder.buildPrompt(
      context,
      `You are analyzing a TypeScript project called "${projectName}".
Project description: ${description}

Based on the code structure, provide:
1. A 2-3 sentence overview of the project architecture
2. Main components and their relationships
3. Technology stack inferred from imports
4. Key architectural patterns used

Be concise and focus on high-level architecture.`
    );

    const response = await this.llmClient.complete({
      prompt,
      systemPrompt: 'You are a software architect. Analyze TypeScript projects and provide architectural summaries.',
      maxTokens: 1500,
    });

    return response.content;
  }
}
