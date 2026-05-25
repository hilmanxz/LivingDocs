import type { GraphDiff, GraphNode, GraphEdge } from '../../../shared/src/types.js';
import { ArchitectureGraph } from './ArchitectureGraph.js';

/**
 * Compare two graphs and return the differences
 */
export function diffGraphs(before: ArchitectureGraph, after: ArchitectureGraph): GraphDiff {
  const beforeNodes = new Map(before.getAllNodes().map(n => [n.id, n]));
  const afterNodes = new Map(after.getAllNodes().map(n => [n.id, n]));

  const beforeEdges = new Map(before.getAllEdges().map(e => [e.id, e]));
  const afterEdges = new Map(after.getAllEdges().map(e => [e.id, e]));

  const diff: GraphDiff = {
    addedNodes: [],
    removedNodes: [],
    modifiedNodes: [],
    addedEdges: [],
    removedEdges: [],
    modifiedEdges: [],
  };

  // Find added and modified nodes
  for (const [nodeId, afterNode] of afterNodes) {
    const beforeNode = beforeNodes.get(nodeId);

    if (!beforeNode) {
      diff.addedNodes.push(afterNode);
    } else if (!nodesEqual(beforeNode, afterNode)) {
      diff.modifiedNodes.push({ before: beforeNode, after: afterNode });
    }
  }

  // Find removed nodes
  for (const [nodeId, beforeNode] of beforeNodes) {
    if (!afterNodes.has(nodeId)) {
      diff.removedNodes.push(beforeNode);
    }
  }

  // Find added and modified edges
  for (const [edgeId, afterEdge] of afterEdges) {
    const beforeEdge = beforeEdges.get(edgeId);

    if (!beforeEdge) {
      diff.addedEdges.push(afterEdge);
    } else if (!edgesEqual(beforeEdge, afterEdge)) {
      diff.modifiedEdges.push({ before: beforeEdge, after: afterEdge });
    }
  }

  // Find removed edges
  for (const [edgeId, beforeEdge] of beforeEdges) {
    if (!afterEdges.has(edgeId)) {
      diff.removedEdges.push(beforeEdge);
    }
  }

  return diff;
}

/**
 * Check if two nodes are equal (ignoring timestamps)
 */
function nodesEqual(node1: GraphNode, node2: GraphNode): boolean {
  return (
    node1.id === node2.id &&
    node1.type === node2.type &&
    node1.name === node2.name &&
    node1.path === node2.path &&
    node1.description === node2.description &&
    metadataEqual(node1.metadata, node2.metadata)
  );
}

/**
 * Check if two edges are equal (ignoring timestamps)
 */
function edgesEqual(edge1: GraphEdge, edge2: GraphEdge): boolean {
  return (
    edge1.id === edge2.id &&
    edge1.source === edge2.source &&
    edge1.target === edge2.target &&
    edge1.type === edge2.type &&
    metadataEqual(edge1.metadata, edge2.metadata)
  );
}

/**
 * Deep equality check for metadata objects
 */
function metadataEqual(
  meta1: Record<string, unknown> | undefined,
  meta2: Record<string, unknown> | undefined
): boolean {
  if (meta1 === meta2) {
    return true;
  }

  if (!meta1 || !meta2) {
    return false;
  }

  const keys1 = Object.keys(meta1);
  const keys2 = Object.keys(meta2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (JSON.stringify(meta1[key]) !== JSON.stringify(meta2[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Format diff as human-readable summary
 */
export function formatDiffSummary(diff: GraphDiff): string {
  const lines: string[] = [];

  if (diff.addedNodes.length > 0) {
    lines.push(`Added ${diff.addedNodes.length} node(s):`);
    for (const node of diff.addedNodes) {
      lines.push(`  + ${node.type}: ${node.name} (${node.id})`);
    }
  }

  if (diff.removedNodes.length > 0) {
    lines.push(`Removed ${diff.removedNodes.length} node(s):`);
    for (const node of diff.removedNodes) {
      lines.push(`  - ${node.type}: ${node.name} (${node.id})`);
    }
  }

  if (diff.modifiedNodes.length > 0) {
    lines.push(`Modified ${diff.modifiedNodes.length} node(s):`);
    for (const { before, after } of diff.modifiedNodes) {
      lines.push(`  ~ ${before.type}: ${before.name} (${before.id})`);
    }
  }

  if (diff.addedEdges.length > 0) {
    lines.push(`Added ${diff.addedEdges.length} edge(s):`);
    for (const edge of diff.addedEdges) {
      lines.push(`  + ${edge.type}: ${edge.source} -> ${edge.target}`);
    }
  }

  if (diff.removedEdges.length > 0) {
    lines.push(`Removed ${diff.removedEdges.length} edge(s):`);
    for (const edge of diff.removedEdges) {
      lines.push(`  - ${edge.type}: ${edge.source} -> ${edge.target}`);
    }
  }

  if (diff.modifiedEdges.length > 0) {
    lines.push(`Modified ${diff.modifiedEdges.length} edge(s):`);
    for (const { before } of diff.modifiedEdges) {
      lines.push(`  ~ ${before.type}: ${before.source} -> ${before.target}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No changes detected';
}
