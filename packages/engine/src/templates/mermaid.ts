import type { SerializedGraph, GraphNode, GraphEdge } from '@livingdocs/shared';

/**
 * Generate a Mermaid dependency diagram from the architecture graph
 */
export function generateDependencyDiagram(graph: SerializedGraph): string {
  const lines: string[] = ['graph TD'];

  // Add nodes
  const nodeMap = new Map<string, GraphNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);

    // Format node based on type
    let nodeLabel = node.name;
    let nodeStyle = '';

    switch (node.type) {
      case 'file':
        nodeStyle = `${node.id}[${nodeLabel}]`;
        break;
      case 'module':
        nodeStyle = `${node.id}[[${nodeLabel}]]`;
        break;
      case 'service':
        nodeStyle = `${node.id}{{${nodeLabel}}}`;
        break;
      case 'route':
        nodeStyle = `${node.id}[/${nodeLabel}/]`;
        break;
      default:
        nodeStyle = `${node.id}(${nodeLabel})`;
    }

    lines.push(`  ${nodeStyle}`);
  }

  // Add edges
  for (const edge of graph.edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target) continue;

    // Format edge based on type
    let edgeStyle = '';
    switch (edge.type) {
      case 'imports':
        edgeStyle = `${edge.source} --> ${edge.target}`;
        break;
      case 'calls':
        edgeStyle = `${edge.source} -.-> ${edge.target}`;
        break;
      case 'extends':
        edgeStyle = `${edge.source} ==> ${edge.target}`;
        break;
      case 'depends_on':
        edgeStyle = `${edge.source} --> ${edge.target}`;
        break;
      default:
        edgeStyle = `${edge.source} --- ${edge.target}`;
    }

    lines.push(`  ${edgeStyle}`);
  }

  // Add styling
  lines.push('');
  lines.push('  classDef fileNode fill:#e1f5ff,stroke:#01579b');
  lines.push('  classDef moduleNode fill:#f3e5f5,stroke:#4a148c');
  lines.push('  classDef serviceNode fill:#fff3e0,stroke:#e65100');

  return lines.join('\n');
}

/**
 * Generate a Mermaid service map diagram
 */
export function generateServiceMap(graph: SerializedGraph): string {
  const lines: string[] = ['graph LR'];

  // Filter for services and routes
  const services = graph.nodes.filter(n => n.type === 'service');
  const routes = graph.nodes.filter(n => n.type === 'route');

  // Add service nodes
  for (const service of services) {
    lines.push(`  ${service.id}{{${service.name}}}`);
  }

  // Add route nodes
  for (const route of routes) {
    lines.push(`  ${route.id}[${route.name}]`);
  }

  // Add edges between services and routes
  for (const edge of graph.edges) {
    const source = graph.nodes.find(n => n.id === edge.source);
    const target = graph.nodes.find(n => n.id === edge.target);

    if (!source || !target) continue;

    // Only show service-to-service and route-to-service connections
    if ((source.type === 'service' || source.type === 'route') &&
        (target.type === 'service' || target.type === 'route')) {

      let label = '';
      if (edge.type === 'http_route') {
        label = '|HTTP|';
      } else if (edge.type === 'calls') {
        label = '|calls|';
      }

      lines.push(`  ${edge.source} ${label}-->${label} ${edge.target}`);
    }
  }

  // Add styling
  lines.push('');
  lines.push('  classDef serviceNode fill:#fff3e0,stroke:#e65100');
  lines.push('  classDef routeNode fill:#e8f5e9,stroke:#1b5e20');

  return lines.join('\n');
}

/**
 * Generate a Mermaid sequence diagram for a flow
 */
export function generateSequenceDiagram(
  graph: SerializedGraph,
  startNodeId: string,
  maxDepth: number = 5
): string {
  const lines: string[] = ['sequenceDiagram'];

  const visited = new Set<string>();
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  const edgesBySource = new Map<string, GraphEdge[]>();

  // Index edges by source
  for (const edge of graph.edges) {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)!.push(edge);
  }

  // Traverse graph and build sequence
  function traverse(nodeId: string, depth: number) {
    if (depth > maxDepth || visited.has(nodeId)) return;

    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const edges = edgesBySource.get(nodeId) || [];

    for (const edge of edges) {
      const target = nodeMap.get(edge.target);
      if (!target) continue;

      const sourceName = node.name.replace(/[^a-zA-Z0-9]/g, '_');
      const targetName = target.name.replace(/[^a-zA-Z0-9]/g, '_');

      if (edge.type === 'calls') {
        lines.push(`  ${sourceName}->>${targetName}: ${edge.type}`);
      } else if (edge.type === 'http_route') {
        lines.push(`  ${sourceName}->>+${targetName}: HTTP Request`);
        lines.push(`  ${targetName}-->>-${sourceName}: Response`);
      }

      traverse(edge.target, depth + 1);
    }
  }

  traverse(startNodeId, 0);

  return lines.join('\n');
}
