import type {
  Graph,
  GraphNode,
  GraphEdge,
  SerializedGraph,
  CircularDependency,
  PathResult,
  NeighborResult,
} from '../../../shared/src/types.js';
import { promises as fs } from 'fs';
import { dirname } from 'path';

/**
 * ArchitectureGraph - In-memory graph data structure for codebase architecture
 *
 * Features:
 * - Efficient node/edge operations using Map and Set
 * - Query methods for traversal and analysis
 * - Circular dependency detection
 * - Serialization for caching
 * - Graph diffing
 */
export class ArchitectureGraph {
  private nodes: Map<string, GraphNode>;
  private edges: Map<string, GraphEdge>;
  private adjacencyList: Map<string, Set<string>>; // nodeId -> Set of outgoing edge IDs
  private reverseAdjacencyList: Map<string, Set<string>>; // nodeId -> Set of incoming edge IDs
  private metadata: Graph['metadata'];

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
    this.metadata = {
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // ============================================================================
  // Node Operations
  // ============================================================================

  /**
   * Add a node to the graph
   */
  addNode(node: GraphNode): void {
    const timestamp = Date.now();
    const nodeWithTimestamp = {
      ...node,
      createdAt: node.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    this.nodes.set(node.id, nodeWithTimestamp);

    // Initialize adjacency lists if not present
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    if (!this.reverseAdjacencyList.has(node.id)) {
      this.reverseAdjacencyList.set(node.id, new Set());
    }

    this.metadata.updatedAt = timestamp;
  }

  /**
   * Remove a node and all its connected edges
   */
  removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    // Remove all edges connected to this node
    const outgoingEdges = this.adjacencyList.get(nodeId) || new Set();
    const incomingEdges = this.reverseAdjacencyList.get(nodeId) || new Set();

    for (const edgeId of outgoingEdges) {
      this.edges.delete(edgeId);
    }

    for (const edgeId of incomingEdges) {
      this.edges.delete(edgeId);
    }

    // Clean up adjacency lists
    this.adjacencyList.delete(nodeId);
    this.reverseAdjacencyList.delete(nodeId);

    // Remove references from other nodes' adjacency lists
    for (const [, edgeSet] of this.adjacencyList) {
      edgeSet.forEach(edgeId => {
        const edge = this.edges.get(edgeId);
        if (edge && edge.target === nodeId) {
          edgeSet.delete(edgeId);
        }
      });
    }

    for (const [, edgeSet] of this.reverseAdjacencyList) {
      edgeSet.forEach(edgeId => {
        const edge = this.edges.get(edgeId);
        if (edge && edge.source === nodeId) {
          edgeSet.delete(edgeId);
        }
      });
    }

    this.nodes.delete(nodeId);
    this.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Check if a node exists
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  // ============================================================================
  // Edge Operations
  // ============================================================================

  /**
   * Add an edge between two nodes
   */
  addEdge(edge: GraphEdge): boolean {
    // Validate that both nodes exist
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      return false;
    }

    const timestamp = Date.now();
    const edgeWithTimestamp = {
      ...edge,
      createdAt: edge.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    this.edges.set(edge.id, edgeWithTimestamp);

    // Update adjacency lists
    const outgoing = this.adjacencyList.get(edge.source);
    if (outgoing) {
      outgoing.add(edge.id);
    }

    const incoming = this.reverseAdjacencyList.get(edge.target);
    if (incoming) {
      incoming.add(edge.id);
    }

    this.metadata.updatedAt = timestamp;
    return true;
  }

  /**
   * Remove an edge
   */
  removeEdge(edgeId: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) {
      return false;
    }

    // Remove from adjacency lists
    const outgoing = this.adjacencyList.get(edge.source);
    if (outgoing) {
      outgoing.delete(edgeId);
    }

    const incoming = this.reverseAdjacencyList.get(edge.target);
    if (incoming) {
      incoming.delete(edgeId);
    }

    this.edges.delete(edgeId);
    this.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: string): GraphEdge | undefined {
    return this.edges.get(edgeId);
  }

  /**
   * Get all edges
   */
  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Get edges between two nodes
   */
  getEdgesBetween(sourceId: string, targetId: string): GraphEdge[] {
    const outgoingEdgeIds = this.adjacencyList.get(sourceId);
    if (!outgoingEdgeIds) {
      return [];
    }

    const result: GraphEdge[] = [];
    for (const edgeId of outgoingEdgeIds) {
      const edge = this.edges.get(edgeId);
      if (edge && edge.target === targetId) {
        result.push(edge);
      }
    }

    return result;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get neighbors of a node (incoming and outgoing)
   */
  getNeighbors(nodeId: string): NeighborResult {
    const incoming: GraphNode[] = [];
    const outgoing: GraphNode[] = [];

    // Get incoming neighbors
    const incomingEdgeIds = this.reverseAdjacencyList.get(nodeId);
    if (incomingEdgeIds) {
      for (const edgeId of incomingEdgeIds) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          const sourceNode = this.nodes.get(edge.source);
          if (sourceNode) {
            incoming.push(sourceNode);
          }
        }
      }
    }

    // Get outgoing neighbors
    const outgoingEdgeIds = this.adjacencyList.get(nodeId);
    if (outgoingEdgeIds) {
      for (const edgeId of outgoingEdgeIds) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          const targetNode = this.nodes.get(edge.target);
          if (targetNode) {
            outgoing.push(targetNode);
          }
        }
      }
    }

    return { incoming, outgoing };
  }

  /**
   * Find shortest path between two nodes using BFS
   */
  findPath(sourceId: string, targetId: string): PathResult {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      return { found: false, path: [], distance: -1 };
    }

    if (sourceId === targetId) {
      return { found: true, path: [sourceId], distance: 0 };
    }

    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: sourceId, path: [sourceId] },
    ];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const outgoingEdgeIds = this.adjacencyList.get(current.nodeId);

      if (!outgoingEdgeIds) {
        continue;
      }

      for (const edgeId of outgoingEdgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge) {
          continue;
        }

        const nextNodeId = edge.target;

        if (nextNodeId === targetId) {
          const path = [...current.path, nextNodeId];
          return {
            found: true,
            path,
            distance: path.length - 1,
          };
        }

        if (!visited.has(nextNodeId)) {
          visited.add(nextNodeId);
          queue.push({
            nodeId: nextNodeId,
            path: [...current.path, nextNodeId],
          });
        }
      }
    }

    return { found: false, path: [], distance: -1 };
  }

  // ============================================================================
  // Circular Dependency Detection
  // ============================================================================

  /**
   * Detect all circular dependencies in the graph
   */
  detectCircularDependencies(): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const pathStack: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      pathStack.push(nodeId);

      const outgoingEdgeIds = this.adjacencyList.get(nodeId);
      if (outgoingEdgeIds) {
        for (const edgeId of outgoingEdgeIds) {
          const edge = this.edges.get(edgeId);
          if (!edge) {
            continue;
          }

          const targetId = edge.target;

          if (!visited.has(targetId)) {
            dfs(targetId);
          } else if (recursionStack.has(targetId)) {
            // Found a cycle
            const cycleStartIndex = pathStack.indexOf(targetId);
            const cycle = pathStack.slice(cycleStartIndex);
            cycle.push(targetId); // Complete the cycle

            // Collect edges in the cycle
            const cycleEdges: GraphEdge[] = [];
            for (let i = 0; i < cycle.length - 1; i++) {
              const edgesBetween = this.getEdgesBetween(cycle[i], cycle[i + 1]);
              cycleEdges.push(...edgesBetween);
            }

            cycles.push({ cycle, edges: cycleEdges });
          }
        }
      }

      pathStack.pop();
      recursionStack.delete(nodeId);
    };

    // Run DFS from all unvisited nodes
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Convert graph to JSON-serializable format
   */
  toJSON(): SerializedGraph {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      metadata: this.metadata,
    };
  }

  /**
   * Create graph from JSON
   */
  static fromJSON(data: SerializedGraph): ArchitectureGraph {
    const graph = new ArchitectureGraph();

    if (data.metadata) {
      graph.metadata = data.metadata;
    }

    // Add all nodes first
    for (const node of data.nodes) {
      graph.addNode(node);
    }

    // Then add all edges
    for (const edge of data.edges) {
      graph.addEdge(edge);
    }

    return graph;
  }

  /**
   * Save graph to file
   */
  async saveToFile(filePath: string): Promise<void> {
    const data = this.toJSON();
    const json = JSON.stringify(data, null, 2);

    // Ensure directory exists
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, json, 'utf-8');
  }

  /**
   * Load graph from file
   */
  static async loadFromFile(filePath: string): Promise<ArchitectureGraph> {
    const json = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(json) as SerializedGraph;
    return ArchitectureGraph.fromJSON(data);
  }

  // ============================================================================
  // Metadata
  // ============================================================================

  /**
   * Get graph metadata
   */
  getMetadata(): Graph['metadata'] {
    return { ...this.metadata };
  }

  /**
   * Update graph metadata
   */
  updateMetadata(metadata: Partial<Graph['metadata']>): void {
    this.metadata = {
      ...this.metadata,
      ...metadata,
      updatedAt: Date.now(),
    };
  }

  /**
   * Get graph statistics
   */
  getStats() {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      nodeTypes: this.getNodeTypeDistribution(),
      edgeTypes: this.getEdgeTypeDistribution(),
    };
  }

  private getNodeTypeDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      distribution[node.type] = (distribution[node.type] || 0) + 1;
    }
    return distribution;
  }

  private getEdgeTypeDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const edge of this.edges.values()) {
      distribution[edge.type] = (distribution[edge.type] || 0) + 1;
    }
    return distribution;
  }

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.metadata.updatedAt = Date.now();
  }
}
