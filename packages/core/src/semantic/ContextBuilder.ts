import type { ParsedFile, Symbol, Dependency, LLMContext } from '@livingdocs/shared';

/**
 * ContextBuilder - Builds context for LLM prompts from parsed files
 */
export class ContextBuilder {
  private maxTokens: number;
  private estimatedCharsPerToken: number = 4; // Rough estimate: 1 token ≈ 4 chars

  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }

  /**
   * Build context for a single file
   */
  buildFileContext(
    filePath: string,
    parsedFile: ParsedFile,
    relatedFiles?: ParsedFile[]
  ): LLMContext {
    const files: LLMContext['files'] = [
      {
        path: filePath,
        content: parsedFile.content,
        summary: this.generateQuickSummary(parsedFile),
      },
    ];

    // Add related files if within token limit
    if (relatedFiles) {
      for (const related of relatedFiles) {
        const estimatedTokens = this.estimateTokens(files);
        if (estimatedTokens < this.maxTokens * 0.7) {
          files.push({
            path: related.filePath,
            content: this.truncateContent(related.content),
            summary: this.generateQuickSummary(related),
          });
        }
      }
    }

    return {
      files,
      symbols: parsedFile.symbols,
      dependencies: this.extractDependencies(parsedFile),
    };
  }

  /**
   * Build context for a folder/module
   */
  buildFolderContext(
    folderPath: string,
    parsedFiles: ParsedFile[]
  ): LLMContext {
    const files: LLMContext['files'] = [];
    const allSymbols: Symbol[] = [];
    const allDependencies: Dependency[] = [];

    for (const parsedFile of parsedFiles) {
      const estimatedTokens = this.estimateTokens(files);

      // Stop adding files if we're near token limit
      if (estimatedTokens > this.maxTokens * 0.8) {
        break;
      }

      files.push({
        path: parsedFile.filePath,
        content: this.truncateContent(parsedFile.content),
        summary: this.generateQuickSummary(parsedFile),
      });

      allSymbols.push(...parsedFile.symbols);
      allDependencies.push(...this.extractDependencies(parsedFile));
    }

    return {
      files,
      symbols: allSymbols,
      dependencies: allDependencies,
      metadata: {
        folderPath,
        fileCount: parsedFiles.length,
        includedFileCount: files.length,
      },
    };
  }

  /**
   * Build context for explaining a specific symbol
   */
  buildSymbolContext(
    symbol: Symbol,
    parsedFile: ParsedFile,
    relatedSymbols?: Symbol[]
  ): LLMContext {
    const files: LLMContext['files'] = [
      {
        path: parsedFile.filePath,
        content: this.extractSymbolContent(symbol, parsedFile),
      },
    ];

    return {
      files,
      symbols: [symbol, ...(relatedSymbols || [])],
      dependencies: this.extractDependencies(parsedFile),
      metadata: {
        symbolName: symbol.name,
        symbolKind: symbol.kind,
      },
    };
  }

  /**
   * Generate a quick summary of a parsed file
   */
  private generateQuickSummary(parsedFile: ParsedFile): string {
    const parts: string[] = [];

    parts.push(`${parsedFile.lineCount} lines`);
    parts.push(`${parsedFile.symbols.length} symbols`);
    parts.push(`${parsedFile.imports.length} imports`);
    parts.push(`${parsedFile.exports.length} exports`);

    return parts.join(', ');
  }

  /**
   * Extract dependencies from parsed file
   */
  private extractDependencies(parsedFile: ParsedFile): Dependency[] {
    return parsedFile.imports.map(imp => ({
      from: parsedFile.filePath,
      to: imp.source,
      type: imp.isTypeOnly ? 'type-import' : 'import' as const,
      specifiers: imp.specifiers.map(s => s.name),
    }));
  }

  /**
   * Estimate token count for files
   */
  private estimateTokens(files: LLMContext['files']): number {
    const totalChars = files.reduce((sum, f) => {
      return sum + (f.content?.length || 0) + (f.summary?.length || 0);
    }, 0);

    return Math.ceil(totalChars / this.estimatedCharsPerToken);
  }

  /**
   * Truncate content to fit within limits
   */
  private truncateContent(content: string, maxLength: number = 2000): string {
    if (content.length <= maxLength) {
      return content;
    }

    return content.slice(0, maxLength) + '\n// ... truncated';
  }

  /**
   * Extract content around a symbol
   */
  private extractSymbolContent(symbol: Symbol, parsedFile: ParsedFile): string {
    const lines = parsedFile.content.split('\n');
    const startLine = Math.max(0, symbol.location.start.line - 5);
    const endLine = Math.min(lines.length, symbol.location.end.line + 5);

    return lines.slice(startLine, endLine).join('\n');
  }

  /**
   * Build a formatted prompt string from context
   */
  buildPrompt(
    context: LLMContext,
    task: string,
    additionalInstructions?: string
  ): string {
    const parts: string[] = [];

    parts.push(task);
    parts.push('');

    parts.push('## Files');
    parts.push('');

    for (const file of context.files) {
      parts.push(`### ${file.path}`);
      if (file.summary) {
        parts.push(`_Summary: ${file.summary}_`);
      }
      parts.push('```');
      parts.push(file.content || '');
      parts.push('```');
      parts.push('');
    }

    if (context.symbols.length > 0) {
      parts.push('## Symbols');
      parts.push('');
      for (const symbol of context.symbols) {
        parts.push(`- ${symbol.kind} \`${symbol.name}\``);
      }
      parts.push('');
    }

    if (context.dependencies.length > 0) {
      parts.push('## Dependencies');
      parts.push('');
      for (const dep of context.dependencies) {
        parts.push(`- \`${dep.to}\``);
      }
      parts.push('');
    }

    if (additionalInstructions) {
      parts.push('## Instructions');
      parts.push('');
      parts.push(additionalInstructions);
      parts.push('');
    }

    return parts.join('\n');
  }
}
