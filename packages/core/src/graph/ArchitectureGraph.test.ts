import { describe, it, expect, beforeEach } from 'vitest';
import { ArchitectureGraph } from './ArchitectureGraph.js';
import type { GraphNode, GraphEdge } from '../../../shared/src/types.js';

describe('ArchitectureGraph', () => {
  let graph: ArchitectureGraph;

  beforeEach(() => {
    graph = new ArchitectureGraph();
  });

  describe('Node Operations', () => {
    it('should add a node', () => {
      const node: GraphNode = {
        id: 'node1',
        type: 'file',
        name: 'index.ts',
        path: '/src/index.ts',
      };

      graph.addNode(node);

      expect(graph.hasNode('node1')).toBe(true);
      expect(graph.getNode('node1')).toMatchObject({
        id: 'node1',
        type: 'file',
        name: 'index.ts',
        path: '/src/index.ts',
      });
    });

    it('should add timestamps to nodes', () => {
      const node: GraphNode = {
        id: 'node1',
        type: 'function',
        name: 'myFunction',
      };

      graph.addNode(node);
      const addedNode = graph.getNode('node1');

      expect(addedNode?.createdAt).toBeDefined();
      expect(addedNode?.updatedAt).toBeDefined();
    });

    it('should remove a node', () => {
      const node: GraphNode = {
        id: 'node1',
        type: 'module',
        name: 'utils',
      };

      graph.addNode(node);
      expect(graph.hasNode('node1')).toBe(true);

      const removed = graph.removeNode('node1');
      expect(removed).toBe(true);
      expect(graph.hasNode('node1')).toBe(false);
    });

    it('should return false when removing non-existent node', () => {
      const removed = graph.removeNode('nonexistent');
      expect(removed).toBe(false);
    });

    it('should remove all edges when removing a node', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const edge: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      };

      graph.addNode(node1);
      graph.addNode(node2);
      graph.addEdge(edge);

      expect(graph.getAllEdges()).toHaveLength(1);

      graph.removeNode('node1');

      expect(graph.getAllEdges()).toHaveLength(0);
    });

    it('should get all nodes', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };

      graph.addNode(node1);
      graph.addNode(node2);

      const nodes = graph.getAllNodes();
      expect(nodes).toHaveLength(2);
      expect(nodes.map(n => n.id)).toContain('node1');
      expect(nodes.map(n => n.id)).toContain('node2');
    });
  });

  describe('Edge Operations', () => {
    beforeEach(() => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      graph.addNode(node1);
      graph.addNode(node2);
    });

    it('should add an edge between nodes', () => {
      const edge: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      };

      const added = graph.addEdge(edge);
      expect(added).toBe(true);
      expect(graph.getEdge('edge1')).toMatchObject({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });
    });

    it('should not add edge if source node does not exist', () => {
      const edge: GraphEdge = {
        id: 'edge1',
        source: 'nonexistent',
        target: 'node2',
        type: 'imports',
      };

      const added = graph.addEdge(edge);
      expect(added).toBe(false);
      expect(graph.getEdge('edge1')).toBeUndefined();
    });

    it('should not add edge if target node does not exist', () => {
      const edge: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'nonexistent',
        type: 'imports',
      };

      const added = graph.addEdge(edge);
      expect(added).toBe(false);
      expect(graph.getEdge('edge1')).toBeUndefined();
    });

    it('should remove an edge', () => {
      const edge: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      };

      graph.addEdge(edge);
      expect(graph.getEdge('edge1')).toBeDefined();

      const removed = graph.removeEdge('edge1');
      expect(removed).toBe(true);
      expect(graph.getEdge('edge1')).toBeUndefined();
    });

    it('should return false when removing non-existent edge', () => {
      const removed = graph.removeEdge('nonexistent');
      expect(removed).toBe(false);
    });

    it('should get edges between two nodes', () => {
      const edge1: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      };
      const edge2: GraphEdge = {
        id: 'edge2',
        source: 'node1',
        target: 'node2',
        type: 'calls',
      };

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      const edges = graph.getEdgesBetween('node1', 'node2');
      expect(edges).toHaveLength(2);
      expect(edges.map(e => e.id)).toContain('edge1');
      expect(edges.map(e => e.id)).toContain('edge2');
    });

    it('should get all edges', () => {
      const edge1: GraphEdge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      };
      const edge2: GraphEdge = {
        id: 'edge2',
        source: 'node2',
        target: 'node1',
        type: 'calls',
      };

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      const edges = graph.getAllEdges();
      expect(edges).toHaveLength(2);
    });
  });

  describe('Query Operations', () => {
    beforeEach(() => {
      // Create a simple graph: node1 -> node2 -> node3
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const node3: GraphNode = { id: 'node3', type: 'file', name: 'c.ts' };

      graph.addNode(node1);
      graph.addNode(node2);
      graph.addNode(node3);

      graph.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });
      graph.addEdge({
        id: 'edge2',
        source: 'node2',
        target: 'node3',
        type: 'imports',
      });
    });

    it('should get neighbors of a node', () => {
      const neighbors = graph.getNeighbors('node2');

      expect(neighbors.incoming).toHaveLength(1);
      expect(neighbors.incoming[0].id).toBe('node1');

      expect(neighbors.outgoing).toHaveLength(1);
      expect(neighbors.outgoing[0].id).toBe('node3');
    });

    it('should find path between two nodes', () => {
      const result = graph.findPath('node1', 'node3');

      expect(result.found).toBe(true);
      expect(result.path).toEqual(['node1', 'node2', 'node3']);
      expect(result.distance).toBe(2);
    });

    it('should return empty path if no path exists', () => {
      const node4: GraphNode = { id: 'node4', type: 'file', name: 'd.ts' };
      graph.addNode(node4);

      const result = graph.findPath('node1', 'node4');

      expect(result.found).toBe(false);
      expect(result.path).toEqual([]);
      expect(result.distance).toBe(-1);
    });

    it('should find path to self', () => {
      const result = graph.findPath('node1', 'node1');

      expect(result.found).toBe(true);
      expect(result.path).toEqual(['node1']);
      expect(result.distance).toBe(0);
    });

    it('should return not found for non-existent nodes', () => {
      const result = graph.findPath('node1', 'nonexistent');

      expect(result.found).toBe(false);
      expect(result.path).toEqual([]);
      expect(result.distance).toBe(-1);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect a simple cycle', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };

      graph.addNode(node1);
      graph.addNode(node2);

      graph.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });
      graph.addEdge({
        id: 'edge2',
        source: 'node2',
        target: 'node1',
        type: 'imports',
      });

      const cycles = graph.detectCircularDependencies();

      expect(cycles).toHaveLength(1);
      expect(cycles[0].cycle).toContain('node1');
      expect(cycles[0].cycle).toContain('node2');
    });

    it('should detect a longer cycle', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const node3: GraphNode = { id: 'node3', type: 'file', name: 'c.ts' };

      graph.addNode(node1);
      graph.addNode(node2);
      graph.addNode(node3);

      graph.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });
      graph.addEdge({
        id: 'edge2',
        source: 'node2',
        target: 'node3',
        type: 'imports',
      });
      graph.addEdge({
        id: 'edge3',
        source: 'node3',
        target: 'node1',
        type: 'imports',
      });

      const cycles = graph.detectCircularDependencies();

      expect(cycles).toHaveLength(1);
      expect(cycles[0].cycle).toHaveLength(4); // [node1, node2, node3, node1]
    });

    it('should return empty array when no cycles exist', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };
      const node3: GraphNode = { id: 'node3', type: 'file', name: 'c.ts' };

      graph.addNode(node1);
      graph.addNode(node2);
      graph.addNode(node3);

      graph.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });
      graph.addEdge({
        id: 'edge2',
        source: 'node2',
        target: 'node3',
        type: 'imports',
      });

      const cycles = graph.detectCircularDependencies();

      expect(cycles).toHaveLength(0);
    });
  });

  describe('Serialization', () => {
    beforeEach(() => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };

      graph.addNode(node1);
      graph.addNode(node2);

      graph.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });
    });

    it('should serialize to JSON', () => {
      const serialized = graph.toJSON();

      expect(serialized.nodes).toHaveLength(2);
      expect(serialized.edges).toHaveLength(1);
      expect(serialized.metadata).toBeDefined();
    });

    it('should deserialize from JSON', () => {
      const serialized = graph.toJSON();
      const newGraph = ArchitectureGraph.fromJSON(serialized);

      expect(newGraph.getAllNodes()).toHaveLength(2);
      expect(newGraph.getAllEdges()).toHaveLength(1);
      expect(newGraph.hasNode('node1')).toBe(true);
      expect(newGraph.hasNode('node2')).toBe(true);
    });

    it('should preserve graph structure after serialization', () => {
      const serialized = graph.toJSON();
      const newGraph = ArchitectureGraph.fromJSON(serialized);

      const neighbors = newGraph.getNeighbors('node1');
      expect(neighbors.outgoing).toHaveLength(1);
      expect(neighbors.outgoing[0].id).toBe('node2');
    });
  });

  describe('Metadata', () => {
    it('should get metadata', () => {
      const metadata = graph.getMetadata();

      expect(metadata.version).toBe('1.0.0');
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.updatedAt).toBeDefined();
    });

    it('should update metadata', () => {
      graph.updateMetadata({ projectRoot: '/path/to/project' });

      const metadata = graph.getMetadata();
      expect(metadata.projectRoot).toBe('/path/to/project');
    });

    it('should get statistics', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'function', name: 'fn' };

      graph.addNode(node1);
      graph.addNode(node2);

      graph.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });

      const stats = graph.getStats();

      expect(stats.nodeCount).toBe(2);
      expect(stats.edgeCount).toBe(1);
      expect(stats.nodeTypes).toEqual({ file: 1, function: 1 });
      expect(stats.edgeTypes).toEqual({ imports: 1 });
    });
  });

  describe('Clear', () => {
    it('should clear all nodes and edges', () => {
      const node1: GraphNode = { id: 'node1', type: 'file', name: 'a.ts' };
      const node2: GraphNode = { id: 'node2', type: 'file', name: 'b.ts' };

      graph.addNode(node1);
      graph.addNode(node2);

      graph.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        type: 'imports',
      });

      expect(graph.getAllNodes()).toHaveLength(2);
      expect(graph.getAllEdges()).toHaveLength(1);

      graph.clear();

      expect(graph.getAllNodes()).toHaveLength(0);
      expect(graph.getAllEdges()).toHaveLength(0);
    });
  });
});
