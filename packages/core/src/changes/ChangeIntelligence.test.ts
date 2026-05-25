import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeIntelligence } from './ChangeIntelligence.js';
import { ArchitectureGraph } from '../graph/ArchitectureGraph.js';
import { LLMClient } from '../semantic/LLMClient.js';
import type { FileDiff, GraphNode, GraphEdge, LLMConfig } from '../../../shared/src/types.js';

describe('ChangeIntelligence', () => {
  let graph: ArchitectureGraph;
  let intelligence: ChangeIntelligence;

  beforeEach(() => {
    graph = new ArchitectureGraph();

    // Create a sample graph structure
    const node1: GraphNode = {
      id: 'node1',
      type: 'file',
      name: 'utils.ts',
      path: 'src/utils.ts'
    };

    const node2: GraphNode = {
      id: 'node2',
      type: 'file',
      name: 'service.ts',
      path: 'src/service.ts'
    };

    const node3: GraphNode = {
      id: 'node3',
      type: 'file',
      name: 'controller.ts',
      path: 'src/controller.ts'
    };

    graph.addNode(node1);
    graph.addNode(node2);
    graph.addNode(node3);

    // node2 imports node1, node3 imports node2
    const edge1: GraphEdge = {
      id: 'edge1',
      source: 'node2',
      target: 'node1',
      type: 'imports'
    };

    const edge2: GraphEdge = {
      id: 'edge2',
      source: 'node3',
      target: 'node2',
      type: 'imports'
    };

    graph.addEdge(edge1);
    graph.addEdge(edge2);

    intelligence = new ChangeIntelligence(graph);
  });

  describe('summarizeChanges', () => {
    it('should summarize a simple modification', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 5,
          deletions: 2,
          hunks: []
        }
      ];

      const summary = await intelligence.summarizeChanges(diffs);

      expect(summary.overview).toContain('1 file');
      expect(summary.affectedModules.length).toBeGreaterThanOrEqual(0);
      expect(summary.riskLevel).toBe('low');
      expect(summary.structuralChanges).toHaveLength(0);
    });

    it('should detect structural changes for new files', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/newFile.ts',
          status: 'added',
          additions: 50,
          deletions: 0,
          hunks: []
        }
      ];

      const summary = await intelligence.summarizeChanges(diffs);

      expect(summary.structuralChanges).toContain('Added 1 new file(s)');
      expect(summary.riskLevel).toBe('low');
    });

    it('should detect structural changes for deleted files', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/oldFile.ts',
          status: 'deleted',
          additions: 0,
          deletions: 30,
          hunks: []
        }
      ];

      const summary = await intelligence.summarizeChanges(diffs);

      expect(summary.structuralChanges).toContain('Deleted 1 file(s)');
      expect(summary.riskLevel).toBe('low');
    });

    it('should detect structural changes for renamed files', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/new-name.ts',
          oldPath: 'src/old-name.ts',
          status: 'renamed',
          additions: 2,
          deletions: 1,
          hunks: []
        }
      ];

      const summary = await intelligence.summarizeChanges(diffs);

      expect(summary.structuralChanges).toContain('Renamed 1 file(s)');
    });

    it('should detect large changes', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/large.ts',
          status: 'modified',
          additions: 80,
          deletions: 40,
          hunks: []
        }
      ];

      const summary = await intelligence.summarizeChanges(diffs);

      expect(summary.structuralChanges.some(c => c.includes('significant changes'))).toBe(true);
    });

    it('should assess medium risk for moderate changes', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 200,
          deletions: 150,
          hunks: []
        },
        {
          path: 'src/service.ts',
          status: 'modified',
          additions: 100,
          deletions: 100,
          hunks: []
        },
        {
          path: 'src/controller.ts',
          status: 'modified',
          additions: 50,
          deletions: 30,
          hunks: []
        },
        {
          path: 'src/file4.ts',
          status: 'deleted',
          additions: 0,
          deletions: 50,
          hunks: []
        }
      ];

      const summary = await intelligence.summarizeChanges(diffs);

      // 4 files (>5? no, 0 pts), 680 changes (>500? yes, 2 pts), 1 deleted (1 pt), nodes with deps (>=3, 1 pt) = 4 -> medium
      expect(summary.riskLevel).toBe('medium');
    });

    it('should assess high risk for large changes', async () => {
      const diffs: FileDiff[] = [
        ...Array.from({ length: 12 }, (_, i) => ({
          path: `src/file${i}.ts`,
          status: 'modified' as const,
          additions: 50,
          deletions: 30,
          hunks: []
        })),
        {
          path: 'src/deleted.ts',
          status: 'deleted' as const,
          additions: 0,
          deletions: 50,
          hunks: []
        }
      ];

      const summary = await intelligence.summarizeChanges(diffs);

      // 13 files (>10, 2 pts), 1010 changes (>500, 2 pts), 1 deleted (1 pt) = 5 -> high
      expect(summary.riskLevel).toBe('high');
    });
  });

  describe('detectImpact', () => {
    it('should identify directly affected nodes', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          hunks: []
        }
      ];

      const impact = await intelligence.detectImpact(diffs);

      expect(impact.directlyAffected).toContain('utils.ts');
    });

    it('should identify potentially affected nodes (dependents)', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          hunks: []
        }
      ];

      const impact = await intelligence.detectImpact(diffs);

      // node2 (service.ts) depends on node1 (utils.ts)
      expect(impact.potentiallyAffected).toContain('service.ts');
    });

    it('should identify regression zones for highly connected nodes', async () => {
      // Add more nodes that depend on utils.ts to make it a critical zone
      for (let i = 4; i <= 10; i++) {
        const node: GraphNode = {
          id: `node${i}`,
          type: 'file',
          name: `file${i}.ts`,
          path: `src/file${i}.ts`
        };
        graph.addNode(node);

        const edge: GraphEdge = {
          id: `edge${i}`,
          source: `node${i}`,
          target: 'node1',
          type: 'imports'
        };
        graph.addEdge(edge);
      }

      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          hunks: []
        }
      ];

      const impact = await intelligence.detectImpact(diffs);

      expect(impact.regressionZones.length).toBeGreaterThan(0);
      expect(impact.regressionZones[0]).toContain('utils.ts');
      expect(impact.regressionZones[0]).toContain('dependents');
    });

    it('should generate risk assessment', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 50,
          deletions: 20,
          hunks: []
        }
      ];

      const impact = await intelligence.detectImpact(diffs);

      expect(impact.riskAssessment).toBeTruthy();
      expect(impact.riskAssessment).toContain('lines');
    });
  });

  describe('generatePRSummary', () => {
    it('should generate a complete PR summary', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          hunks: []
        },
        {
          path: 'src/newFile.ts',
          status: 'added',
          additions: 30,
          deletions: 0,
          hunks: []
        }
      ];

      const prSummary = await intelligence.generatePRSummary(diffs);

      expect(prSummary).toContain('## Summary');
      expect(prSummary).toContain('## Structural Changes');
      expect(prSummary).toContain('## Affected Modules');
      expect(prSummary).toContain('## Impact Analysis');
      expect(prSummary).toContain('## Files Changed');
      expect(prSummary).toContain('Risk Level:');
      expect(prSummary).toContain('1 files added');
      expect(prSummary).toContain('1 files modified');
    });

    it('should include renamed files in summary', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/new-name.ts',
          oldPath: 'src/old-name.ts',
          status: 'renamed',
          additions: 2,
          deletions: 1,
          hunks: []
        }
      ];

      const prSummary = await intelligence.generatePRSummary(diffs);

      expect(prSummary).toContain('1 files renamed');
    });

    it('should include directly and potentially affected modules', async () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          hunks: []
        }
      ];

      const prSummary = await intelligence.generatePRSummary(diffs);

      expect(prSummary).toContain('Directly Affected:');
      expect(prSummary).toContain('Potentially Affected:');
    });
  });

  describe('with LLM client', () => {
    it('should use LLM for overview generation when available', async () => {
      const mockLLMClient = {
        complete: vi.fn().mockResolvedValue({
          content: 'This change refactors the utility functions to improve performance.',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        })
      } as unknown as LLMClient;

      const intelligenceWithLLM = new ChangeIntelligence(graph, mockLLMClient);

      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          hunks: []
        }
      ];

      const summary = await intelligenceWithLLM.summarizeChanges(diffs);

      expect(mockLLMClient.complete).toHaveBeenCalled();
      expect(summary.overview).toContain('refactors');
    });

    it('should fallback to basic overview if LLM fails', async () => {
      const mockLLMClient = {
        complete: vi.fn().mockRejectedValue(new Error('LLM API error'))
      } as unknown as LLMClient;

      const intelligenceWithLLM = new ChangeIntelligence(graph, mockLLMClient);

      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          hunks: []
        }
      ];

      const summary = await intelligenceWithLLM.summarizeChanges(diffs);

      expect(summary.overview).toContain('1 file');
    });

    it('should use LLM for risk assessment when available', async () => {
      const mockLLMClient = {
        complete: vi.fn().mockResolvedValue({
          content: 'High risk: changes affect core utility functions used throughout the codebase.',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        })
      } as unknown as LLMClient;

      const intelligenceWithLLM = new ChangeIntelligence(graph, mockLLMClient);

      const diffs: FileDiff[] = [
        {
          path: 'src/utils.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          hunks: []
        }
      ];

      const impact = await intelligenceWithLLM.detectImpact(diffs);

      expect(mockLLMClient.complete).toHaveBeenCalled();
      expect(impact.riskAssessment).toContain('High risk');
    });
  });
});
