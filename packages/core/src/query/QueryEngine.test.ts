import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryEngine } from './QueryEngine.js';
import { ArchitectureGraph } from '../graph/ArchitectureGraph.js';
import { LLMClient } from '../semantic/LLMClient.js';
import { ContextBuilder } from '../semantic/ContextBuilder.js';
import type { GraphNode, LLMResponse } from '@livingdocs/shared';

describe('QueryEngine', () => {
  let graph: ArchitectureGraph;
  let llmClient: LLMClient;
  let contextBuilder: ContextBuilder;
  let queryEngine: QueryEngine;

  beforeEach(() => {
    // Create a test graph with sample nodes
    graph = new ArchitectureGraph();

    // Add sample nodes
    const authServiceNode: GraphNode = {
      id: 'service:auth',
      type: 'service',
      name: 'AuthService',
      path: 'src/services/auth.ts',
      description: 'Authentication service using Redis for session storage',
    };

    const redisNode: GraphNode = {
      id: 'module:redis',
      type: 'module',
      name: 'redis',
      path: 'src/lib/redis.ts',
      description: 'Redis client wrapper',
    };

    const userServiceNode: GraphNode = {
      id: 'service:user',
      type: 'service',
      name: 'UserService',
      path: 'src/services/user.ts',
      description: 'User management service',
    };

    const databaseNode: GraphNode = {
      id: 'module:database',
      type: 'module',
      name: 'database',
      path: 'src/lib/database.ts',
      description: 'Database connection and query utilities',
    };

    graph.addNode(authServiceNode);
    graph.addNode(redisNode);
    graph.addNode(userServiceNode);
    graph.addNode(databaseNode);

    // Add edges
    graph.addEdge({
      id: 'edge:auth-redis',
      source: 'service:auth',
      target: 'module:redis',
      type: 'depends_on',
    });

    graph.addEdge({
      id: 'edge:user-database',
      source: 'service:user',
      target: 'module:database',
      type: 'depends_on',
    });

    // Mock LLM client
    llmClient = {
      complete: vi.fn(),
    } as any;

    // Create context builder
    contextBuilder = new ContextBuilder(8000);

    // Create query engine
    queryEngine = new QueryEngine(graph, llmClient, contextBuilder);
  });

  describe('query', () => {
    it('should answer a question about the codebase', async () => {
      // Mock LLM response
      const mockResponse: LLMResponse = {
        content:
          'The AuthService uses Redis for session storage because Redis provides fast in-memory storage with built-in expiration, making it ideal for managing user sessions.',
        usage: {
          promptTokens: 500,
          completionTokens: 50,
          totalTokens: 550,
        },
      };

      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      const result = await queryEngine.query('Why does auth use Redis?');

      expect(result.answer).toBe(mockResponse.content);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.sources).toBeInstanceOf(Array);
      expect(result.relatedNodes).toBeInstanceOf(Array);
      expect(llmClient.complete).toHaveBeenCalledOnce();
    });

    it('should include relevant sources in the result', async () => {
      const mockResponse: LLMResponse = {
        content: 'The database module provides connection pooling and query utilities.',
        usage: {
          promptTokens: 400,
          completionTokens: 30,
          totalTokens: 430,
        },
      };

      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      const result = await queryEngine.query('What does the database module do?');

      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.sources[0]).toHaveProperty('path');
      expect(result.sources[0]).toHaveProperty('relevance');
      expect(result.sources[0].relevance).toBeGreaterThan(0);
      expect(result.sources[0].relevance).toBeLessThanOrEqual(1);
    });

    it('should include related nodes in the result', async () => {
      const mockResponse: LLMResponse = {
        content: 'UserService depends on the database module for data persistence.',
        usage: {
          promptTokens: 450,
          completionTokens: 40,
          totalTokens: 490,
        },
      };

      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      const result = await queryEngine.query('What depends on database?');

      expect(result.relatedNodes.length).toBeGreaterThan(0);
      expect(result.relatedNodes[0]).toHaveProperty('id');
      expect(result.relatedNodes[0]).toHaveProperty('type');
      expect(result.relatedNodes[0]).toHaveProperty('name');
    });
  });

  describe('classifyQuestion', () => {
    it('should classify "why" questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      await queryEngine.query('Why does auth use Redis?');

      const callArgs = vi.mocked(llmClient.complete).mock.calls[0][0];
      expect(callArgs.prompt).toContain('architectural decisions');
    });

    it('should classify "how" questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      await queryEngine.query('How does a request reach the auth service?');

      const callArgs = vi.mocked(llmClient.complete).mock.calls[0][0];
      expect(callArgs.prompt).toContain('flow of execution');
    });

    it('should classify "what" questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      await queryEngine.query('What is the UserService?');

      const callArgs = vi.mocked(llmClient.complete).mock.calls[0][0];
      expect(callArgs.prompt).toContain('clear description');
    });

    it('should classify "where" questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      await queryEngine.query('Where is the auth service defined?');

      const callArgs = vi.mocked(llmClient.complete).mock.calls[0][0];
      expect(callArgs.prompt).toContain('specific location');
    });

    it('should classify "impact" questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      await queryEngine.query('What would break if I change the database module?');

      const callArgs = vi.mocked(llmClient.complete).mock.calls[0][0];
      expect(callArgs.prompt).toContain('potential impact');
    });

    it('should classify "dependency" questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      await queryEngine.query('What modules depend on database?');

      const callArgs = vi.mocked(llmClient.complete).mock.calls[0][0];
      expect(callArgs.prompt).toContain('dependency relationships');
    });
  });

  describe('confidence calculation', () => {
    it('should return higher confidence for "where" questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'Located in src/services/auth.ts',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      const result = await queryEngine.query('Where is AuthService defined?');

      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should return lower confidence for "why" questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'Because of architectural reasons',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      const result = await queryEngine.query('Why was this architecture chosen?');

      // "why" questions have lower base confidence
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe('context retrieval', () => {
    it('should find relevant nodes based on keywords', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer about auth',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      await queryEngine.query('Tell me about the auth service');

      const callArgs = vi.mocked(llmClient.complete).mock.calls[0][0];
      expect(callArgs.prompt).toContain('auth');
    });

    it('should pass system prompt to LLM', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      await queryEngine.query('What is this?');

      const callArgs = vi.mocked(llmClient.complete).mock.calls[0][0];
      expect(callArgs.systemPrompt).toBeDefined();
      expect(callArgs.systemPrompt).toContain('code analyst');
    });

    it('should use appropriate temperature for queries', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      };
      vi.mocked(llmClient.complete).mockResolvedValue(mockResponse);

      await queryEngine.query('What is this?');

      const callArgs = vi.mocked(llmClient.complete).mock.calls[0][0];
      expect(callArgs.temperature).toBe(0.3); // Low temperature for factual answers
    });
  });
});
