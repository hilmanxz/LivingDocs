import { describe, it, expect, beforeEach } from 'vitest';
import { diffGraphs, formatDiffSummary } from './diff.js';
import { ArchitectureGraph } from './ArchitectureGraph.js';
import type { GraphNode, GraphEdge } from '../../../shared/src/types.js';

describe('Graph Diff', () => {
  let beforeGraph: ArchitectureGraph;
  let afterGraph: ArchitectureGraph;

  beforeEach(() => {
    beforeGraph = new ArchitectureGraph();
    afterGraph = new ArchitectureGraph();
  });

  describe('diffGraphs', () => {
    it('should detect added nodes', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };

      beforeGraph.addNode(node1);
      afterGraph.addNode(node1);
      afterGraph.addNode(node2);

      const diff = diffGraphs(beforeGraph, afterGraph);

      expect(diff.addedNodes).toHaveLength(1);
      expect(diff.addedNodes[0].id).toBe('node2');
      expect(diff.removedNodes).toHaveLength(0);
      expect(diff.modifiedNodes).toHaveLength(0);
    });

    it('should detect removed nodes', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };

      beforeGraph.addNode(node1);
      beforeGraph.addNode(node2);
      afterGraph.addNode(node1);

      const diff = diffGraphs(beforeGraph, afterGraph);

      expect(diff.removedNodes).toHaveLength(1);
      expect(diff.removedNodes[0].id).toBe('node2');
      expect(diff.addedNodes).toHaveLength(0);
      expect(diff.modifiedNodes).toHaveLength(0);
    });

    it('should detect modified nodes', () => {
      const node1Before: GraphNode = {
        id: 'node1',
        type: 'file',
        name: 'a.ts',
        description: 'Old description',
      };
      const node1After: GraphNode = {
        id: 'node1',
        type: 'file',
        name: 'a.ts',
        description: 'New description',
      };

      beforeGraph.addNode(node1Before);
      afterGraph.addNode(node1After);

      const diff = diffGraphs(beforeGraph, afterGraph);

      expect(diff.modifiedNodes).toHaveLength(1);
      expect(diff.modifiedNodes[0].before.description).toBe('Old description');
      expect(diff.modifiedNodes[0].after.description).toBe('New description');
      expect(diff.addedNodes).toHaveLength(0);
      expect(diff.removedNodes).toHaveLength(0);
    });

    it('should detect added edges', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const edge: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      };

      beforeGraph.addNode(node1);
      beforeGraph.addNode(node2);

      afterGraph.addNode(node1);
      afterGraph.addNode(node2);
      afterGraph.addEdge(edge);

      const diff = diffGraphs(beforeGraph, afterGraph);

      expect(diff.addedEdges).toHaveLength(1);
      expect(diff.addedEdges[0].id).toBe('edge1');
      expect(diff.removedEdges).toHaveLength(0);
      expect(diff.modifiedEdges).toHaveLength(0);
    });

    it('should detect removed edges', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const edge: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      };

      beforeGraph.addNode(node1);
      beforeGraph.addNode(node2);
      beforeGraph.addEdge(edge);

      afterGraph.addNode(node1);
      afterGraph.addNode(node2);

      const diff = diffGraphs(beforeGraph, afterGraph);

      expect(diff.removedEdges).toHaveLength(1);
      expect(diff.removedEdges[0].id).toBe('edge1');
      expect(diff.addedEdges).toHaveLength(0);
      expect(diff.modifiedEdges).toHaveLength(0);
    });

    it('should detect modified edges', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };

      const edgeBefore: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
        metadata: { version: 1 },
      };

      const edgeAfter: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
        metadata: { version: 2 },
      };

      beforeGraph.addNode(node1);
      beforeGraph.addNode(node2);
      beforeGraph.addEdge(edgeBefore);

      afterGraph.addNode(node1);
      afterGraph.addNode(node2);
      afterGraph.addEdge(edgeAfter);

      const diff = diffGraphs(beforeGraph, afterGraph);

      expect(diff.modifiedEdges).toHaveLength(1);
      expect(diff.modifiedEdges[0].before.metadata?.version).toBe(1);
      expect(diff.modifiedEdges[0].after.metadata?.version).toBe(2);
      expect(diff.addedEdges).toHaveLength(0);
      expect(diff.removedEdges).toHaveLength(0);
    });

    it('should handle complex changes', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const node3: GraphNode = { id: 'node3', type: 'file', name: 'c.ts' };

      beforeGraph.addNode(node1);
      beforeGraph.addNode(node2);

      afterGraph.addNode(node1);
      afterGraph.addNode(node2);
      afterGraph.addNode(node3);

      afterGraph.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });

      const diff = diffGraphs(beforeGraph, afterGraph);

      expect(diff.addedNodes).toHaveLength(1);
      expect(diff.addedEdges).toHaveLength(1);
      expect(diff.removedNodes).toHaveLength(0);
      expect(diff.removedEdges).toHaveLength(0);
    });

    it('should return empty diff for identical graphs', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };

      beforeGraph.addNode(node1);
      afterGraph.addNode(node1);

      const diff = diffGraphs(beforeGraph, afterGraph);

      expect(diff.addedNodes).toHaveLength(0);
      expect(diff.removedNodes).toHaveLength(0);
      expect(diff.modifiedNodes).toHaveLength(0);
      expect(diff.addedEdges).toHaveLength(0);
      expect(diff.removedEdges).toHaveLength(0);
      expect(diff.modifiedEdges).toHaveLength(0);
    });
  });

  describe('formatDiffSummary', () => {
    it('should format added nodes', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };

      beforeGraph.addNode(node1);
      afterGraph.addNode(node1);
      afterGraph.addNode(node2);

      const diff = diffGraphs(beforeGraph, afterGraph);
      const summary = formatDiffSummary(diff);

      expect(summary).toContain('Added 1 node(s)');
      expect(summary).toContain('file: b.ts');
    });

    it('should format removed nodes', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };

      beforeGraph.addNode(node1);
      beforeGraph.addNode(node2);
      afterGraph.addNode(node1);

      const diff = diffGraphs(beforeGraph, afterGraph);
      const summary = formatDiffSummary(diff);

      expect(summary).toContain('Removed 1 node(s)');
      expect(summary).toContain('file: b.ts');
    });

    it('should format modified nodes', () => {
      const node1Before: GraphNode = {
        id: 'node1',
        type: 'file',
        name: 'a.ts',
        description: 'Old',
      };
      const node1After: GraphNode = {
        id: 'node1',
        type: 'file',
        name: 'a.ts',
        description: 'New',
      };

      beforeGraph.addNode(node1Before);
      afterGraph.addNode(node1After);

      const diff = diffGraphs(beforeGraph, afterGraph);
      const summary = formatDiffSummary(diff);

      expect(summary).toContain('Modified 1 node(s)');
      expect(summary).toContain('file: a.ts');
    });

    it('should format added edges', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const edge: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      };

      beforeGraph.addNode(node1);
      beforeGraph.addNode(node2);

      afterGraph.addNode(node1);
      afterGraph.addNode(node2);
      afterGraph.addEdge(edge);

      const diff = diffGraphs(beforeGraph, afterGraph);
      const summary = formatDiffSummary(diff);

      expect(summary).toContain('Added 1 edge(s)');
      expect(summary).toContain('imports: node1 -> node2');
    });

    it('should format removed edges', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const edge: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      };

      beforeGraph.addNode(node1);
      beforeGraph.addNode(node2);
      beforeGraph.addEdge(edge);

      afterGraph.addNode(node1);
      afterGraph.addNode(node2);

      const diff = diffGraphs(beforeGraph, afterGraph);
      const summary = formatDiffSummary(diff);

      expect(summary).toContain('Removed 1 edge(s)');
      expect(summary).toContain('imports: node1 -> node2');
    });

    it('should return "No changes detected" for empty diff', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };

      beforeGraph.addNode(node1);
      afterGraph.addNode(node1);

      const diff = diffGraphs(beforeGraph, afterGraph);
      const summary = formatDiffSummary(diff);

      expect(summary).toBe('No changes detected');
    });

    it('should format multiple changes', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const node3: GraphNode = { id: 'node3', type: 'file', name: 'c.ts' };

      beforeGraph.addNode(node1);
      beforeGraph.addNode(node2);

      afterGraph.addNode(node1);
      afterGraph.addNode(node2);
      afterGraph.addNode(node3);

      afterGraph.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });

      const diff = diffGraphs(beforeGraph, afterGraph);
      const summary = formatDiffSummary(diff);

      expect(summary).toContain('Added 1 node(s)');
      expect(summary).toContain('Added 1 edge(s)');
    });
  });
});
