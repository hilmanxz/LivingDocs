import type {
  QueryResult,
  QuestionType,
  LLMContext,
  GraphNode,
  NodeType,
  EdgeType,
} from '@livingdocs/shared';
import type { ArchitectureGraph } from '../graph/ArchitectureGraph.js';
import type { LLMClient } from '../semantic/LLMClient.js';
import type { ContextBuilder } from '../semantic/ContextBuilder.js';

/**
 * QueryEngine - Natural language query interface for codebase understanding
 *
 * Allows developers to ask questions about their codebase and get answers
 * backed by static analysis and semantic understanding.
 */
export class QueryEngine {
  private graph: ArchitectureGraph;
  private llmClient: LLMClient;
  private contextBuilder: ContextBuilder;

  constructor(
    graph: ArchitectureGraph,
    llmClient: LLMClient,
    contextBuilder: ContextBuilder
  ) {
    this.graph = graph;
    this.llmClient = llmClient;
    this.contextBuilder = contextBuilder;
  }

  /**
   * Answer a natural language question about the codebase
   */
  async query(question: string): Promise<QueryResult> {
    // Classify the question type
    const questionType = this.classifyQuestion(question);

    // Find relevant context based on question type
    const context = await this.findRelevantContext(question, questionType);

    // Build prompt for LLM
    const prompt = this.contextBuilder.buildPrompt(
      context,
      `Answer the following question about the codebase: "${question}"`,
      this.getInstructionsForQuestionType(questionType)
    );

    // Get answer from LLM
    const response = await this.llmClient.complete({
      prompt,
      systemPrompt: this.getSystemPrompt(),
      maxTokens: 1500,
      temperature: 0.3,
    });

    // Calculate confidence based on context quality
    const confidence = this.calculateConfidence(context, questionType);

    // Extract sources from context
    const sources = context.files.map((file, index) => ({
      path: file.path,
      relevance: 1 - index * 0.1, // Simple relevance scoring
    }));

    // Get related nodes from context
    const relatedNodes = this.extractRelatedNodes(context);

    return {
      answer: response.content,
      confidence,
      sources,
      relatedNodes,
    };
  }

  /**
   * Classify question type based on keywords and structure
   */
  private classifyQuestion(question: string): QuestionType {
    const lowerQuestion = question.toLowerCase();

    // Why questions - architectural decisions, rationale
    if (lowerQuestion.startsWith('why') || lowerQuestion.includes('reason for')) {
      return 'why';
    }

    // How questions - flow, process, implementation
    if (
      lowerQuestion.startsWith('how') ||
      lowerQuestion.includes('flow') ||
      lowerQuestion.includes('process')
    ) {
      return 'how';
    }

    // Where questions - location, definition
    if (
      lowerQuestion.startsWith('where') ||
      lowerQuestion.includes('located') ||
      lowerQuestion.includes('defined')
    ) {
      return 'where';
    }

    // Impact questions - effects, consequences
    if (
      lowerQuestion.includes('impact') ||
      lowerQuestion.includes('affect') ||
      lowerQuestion.includes('break')
    ) {
      return 'impact';
    }

    // Dependency questions - relationships (use word boundaries to avoid matching substrings)
    if (
      /\bdepend\b/.test(lowerQuestion) ||
      /\buses\b/.test(lowerQuestion) ||
      /\busing\b/.test(lowerQuestion) ||
      /\bimport\b/.test(lowerQuestion) ||
      /\bcall\b/.test(lowerQuestion)
    ) {
      return 'dependency';
    }

    // What questions - general information (default)
    return 'what';
  }

  /**
   * Find relevant context for a question
   */
  private async findRelevantContext(
    question: string,
    questionType: QuestionType
  ): Promise<LLMContext> {
    const relevantNodes = this.findRelevantNodes(question, questionType);

    // Build context from relevant nodes
    const files: LLMContext['files'] = [];
    const symbols: LLMContext['symbols'] = [];
    const dependencies: LLMContext['dependencies'] = [];

    for (const node of relevantNodes.slice(0, 5)) {
      // Limit to top 5 nodes
      if (node.path) {
        files.push({
          path: node.path,
          content: node.description || '',
          summary: `${node.type}: ${node.name}`,
        });
      }

      // Add metadata as symbols if available
      if (node.metadata?.symbols) {
        symbols.push(...(node.metadata.symbols as any[]));
      }
    }

    return {
      files,
      symbols,
      dependencies,
      metadata: {
        questionType,
        nodeCount: relevantNodes.length,
      },
    };
  }

  /**
   * Find relevant nodes based on question and type
   */
  private findRelevantNodes(question: string, questionType: QuestionType): GraphNode[] {
    const allNodes = this.graph.getAllNodes();
    const scoredNodes: Array<{ node: GraphNode; score: number }> = [];

    // Extract keywords from question
    const keywords = this.extractKeywords(question);

    for (const node of allNodes) {
      let score = 0;

      // Score based on name matching
      for (const keyword of keywords) {
        if (node.name.toLowerCase().includes(keyword)) {
          score += 10;
        }
        if (node.path?.toLowerCase().includes(keyword)) {
          score += 5;
        }
        if (node.description?.toLowerCase().includes(keyword)) {
          score += 3;
        }
      }

      // Boost score based on question type
      score += this.getNodeTypeBoost(node.type, questionType);

      if (score > 0) {
        scoredNodes.push({ node, score });
      }
    }

    // Sort by score and return top nodes
    scoredNodes.sort((a, b) => b.score - a.score);
    return scoredNodes.map(sn => sn.node);
  }

  /**
   * Extract keywords from question
   */
  private extractKeywords(question: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'does',
      'do',
      'did',
      'what',
      'where',
      'when',
      'why',
      'how',
      'which',
      'who',
      'can',
      'could',
      'should',
      'would',
      'will',
    ]);

    return question
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Get node type boost based on question type
   */
  private getNodeTypeBoost(nodeType: NodeType, questionType: QuestionType): number {
    const boosts: Record<QuestionType, Partial<Record<NodeType, number>>> = {
      why: {
        service: 5,
        class: 3,
        module: 3,
      },
      how: {
        function: 5,
        route: 5,
        service: 3,
      },
      what: {
        class: 3,
        interface: 3,
        module: 3,
      },
      where: {
        file: 5,
        module: 5,
      },
      impact: {
        service: 5,
        module: 5,
        class: 3,
      },
      dependency: {
        module: 5,
        file: 5,
        service: 3,
      },
    };

    return boosts[questionType]?.[nodeType] || 0;
  }

  /**
   * Get instructions for specific question type
   */
  private getInstructionsForQuestionType(questionType: QuestionType): string {
    const instructions: Record<QuestionType, string> = {
      why: 'Focus on architectural decisions, design rationale, and the reasoning behind implementation choices. Explain the trade-offs and benefits.',
      how: 'Trace the flow of execution, explain the process step-by-step, and describe how different components interact.',
      what: 'Provide a clear description of what the code does, its purpose, and its key functionality.',
      where: 'Identify the specific location, file path, and context where the code or functionality is defined.',
      impact: 'Analyze the potential impact of changes, identify affected components, and assess risks.',
      dependency: 'Map out the dependency relationships, show what depends on what, and explain the connections.',
    };

    return instructions[questionType];
  }

  /**
   * Get system prompt for LLM
   */
  private getSystemPrompt(): string {
    return `You are an expert code analyst helping developers understand their codebase.

Your role is to:
- Answer questions accurately based on the provided code context
- Explain technical concepts clearly and concisely
- Reference specific files, functions, and modules when relevant
- Admit when you don't have enough information to answer confidently

Guidelines:
- Be precise and technical but accessible
- Use code examples when helpful
- Cite specific file paths and line numbers when available
- If the context is insufficient, say so and suggest what additional information would help`;
  }

  /**
   * Calculate confidence score based on context quality
   */
  private calculateConfidence(context: LLMContext, questionType: QuestionType): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence based on context richness
    if (context.files.length > 0) {
      confidence += 0.2;
    }

    if (context.symbols.length > 0) {
      confidence += 0.1;
    }

    if (context.dependencies.length > 0) {
      confidence += 0.1;
    }

    // Adjust based on question type complexity
    const complexityAdjustment: Record<QuestionType, number> = {
      where: 0.1, // Easier to answer with high confidence
      what: 0.05,
      dependency: 0.05,
      how: 0,
      why: -0.05, // Harder to answer with certainty
      impact: -0.1,
    };

    confidence += complexityAdjustment[questionType];

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract related nodes from context
   */
  private extractRelatedNodes(context: LLMContext): GraphNode[] {
    const nodes: GraphNode[] = [];
    const allNodes = this.graph.getAllNodes();

    // Get nodes for each file in context by matching path
    for (const file of context.files) {
      // Find node by path (handles different ID prefixes like service:, module:, file:)
      const node = allNodes.find(n => n.path === file.path);
      if (node) {
        nodes.push(node);

        // Also add immediate neighbors
        const neighbors = this.graph.getNeighbors(node.id);
        nodes.push(...neighbors.incoming.slice(0, 2));
        nodes.push(...neighbors.outgoing.slice(0, 2));
      }
    }

    // Deduplicate by ID
    const uniqueNodes = new Map<string, GraphNode>();
    for (const node of nodes) {
      uniqueNodes.set(node.id, node);
    }

    return Array.from(uniqueNodes.values());
  }
}
