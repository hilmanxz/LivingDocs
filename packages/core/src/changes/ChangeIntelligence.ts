import type { FileDiff, ChangeSummary, ImpactReport, GraphNode } from '../../../shared/src/types.js';
import { ArchitectureGraph } from '../graph/ArchitectureGraph.js';
import { LLMClient } from '../semantic/LLMClient.js';

/**
 * ChangeIntelligence - Analyzes code changes and maps them to architecture
 *
 * Uses the architecture graph to understand impact and LLM for intelligent summaries
 */
export class ChangeIntelligence {
  private graph: ArchitectureGraph;
  private llmClient?: LLMClient;

  constructor(graph: ArchitectureGraph, llmClient?: LLMClient) {
    this.graph = graph;
    this.llmClient = llmClient;
  }

  /**
   * Summarize changes from a diff
   */
  async summarizeChanges(diffs: FileDiff[]): Promise<ChangeSummary> {
    // Analyze the diffs to understand what changed
    const affectedFiles = diffs.map(d => d.path);
    const affectedNodes = this.findAffectedNodes(affectedFiles);

    // Determine structural changes
    const structuralChanges = this.detectStructuralChanges(diffs);

    // Find affected modules
    const affectedModules = this.findAffectedModules(affectedNodes);

    // Assess risk level
    const riskLevel = this.assessRiskLevel(diffs, affectedNodes);

    // Generate overview using LLM if available
    let overview = '';
    if (this.llmClient) {
      overview = await this.generateOverview(diffs, affectedModules);
    } else {
      overview = this.generateBasicOverview(diffs);
    }

    return {
      overview,
      structuralChanges,
      affectedModules,
      riskLevel
    };
  }

  /**
   * Detect impact of changes
   */
  async detectImpact(diffs: FileDiff[]): Promise<ImpactReport> {
    const affectedFiles = diffs.map(d => d.path);
    const affectedNodes = this.findAffectedNodes(affectedFiles);

    // Find directly affected nodes
    const directlyAffected = affectedNodes.map(n => n.name);

    // Find potentially affected nodes (dependencies)
    const potentiallyAffected = this.findDependentNodes(affectedNodes);

    // Identify regression zones (critical paths)
    const regressionZones = this.identifyRegressionZones(affectedNodes);

    // Generate risk assessment
    let riskAssessment = '';
    if (this.llmClient) {
      riskAssessment = await this.generateRiskAssessment(diffs, directlyAffected, potentiallyAffected);
    } else {
      riskAssessment = this.generateBasicRiskAssessment(diffs, directlyAffected, potentiallyAffected);
    }

    return {
      directlyAffected,
      potentiallyAffected,
      regressionZones,
      riskAssessment
    };
  }

  /**
   * Generate PR description
   */
  async generatePRSummary(diffs: FileDiff[]): Promise<string> {
    const summary = await this.summarizeChanges(diffs);
    const impact = await this.detectImpact(diffs);

    // Build PR description
    let prDescription = `## Summary\n\n${summary.overview}\n\n`;

    if (summary.structuralChanges.length > 0) {
      prDescription += `## Structural Changes\n\n`;
      summary.structuralChanges.forEach(change => {
        prDescription += `- ${change}\n`;
      });
      prDescription += '\n';
    }

    if (summary.affectedModules.length > 0) {
      prDescription += `## Affected Modules\n\n`;
      summary.affectedModules.forEach(module => {
        prDescription += `- ${module}\n`;
      });
      prDescription += '\n';
    }

    prDescription += `## Impact Analysis\n\n`;
    prDescription += `**Risk Level:** ${summary.riskLevel}\n\n`;
    prDescription += `${impact.riskAssessment}\n\n`;

    if (impact.directlyAffected.length > 0) {
      prDescription += `**Directly Affected:** ${impact.directlyAffected.join(', ')}\n\n`;
    }

    if (impact.potentiallyAffected.length > 0) {
      prDescription += `**Potentially Affected:** ${impact.potentiallyAffected.join(', ')}\n\n`;
    }

    // File changes summary
    prDescription += `## Files Changed\n\n`;
    const added = diffs.filter(d => d.status === 'added').length;
    const modified = diffs.filter(d => d.status === 'modified').length;
    const deleted = diffs.filter(d => d.status === 'deleted').length;
    const renamed = diffs.filter(d => d.status === 'renamed').length;

    prDescription += `- ${added} files added\n`;
    prDescription += `- ${modified} files modified\n`;
    prDescription += `- ${deleted} files deleted\n`;
    if (renamed > 0) {
      prDescription += `- ${renamed} files renamed\n`;
    }

    return prDescription;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Find graph nodes affected by file changes
   */
  private findAffectedNodes(filePaths: string[]): GraphNode[] {
    const nodes: GraphNode[] = [];
    const allNodes = this.graph.getAllNodes();

    for (const node of allNodes) {
      if (node.path && filePaths.some(fp => node.path === fp || node.path?.includes(fp))) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  /**
   * Detect structural changes (additions, deletions, renames)
   */
  private detectStructuralChanges(diffs: FileDiff[]): string[] {
    const changes: string[] = [];

    const added = diffs.filter(d => d.status === 'added');
    const deleted = diffs.filter(d => d.status === 'deleted');
    const renamed = diffs.filter(d => d.status === 'renamed');

    if (added.length > 0) {
      changes.push(`Added ${added.length} new file(s)`);
    }
    if (deleted.length > 0) {
      changes.push(`Deleted ${deleted.length} file(s)`);
    }
    if (renamed.length > 0) {
      changes.push(`Renamed ${renamed.length} file(s)`);
    }

    // Check for large changes
    const largeChanges = diffs.filter(d => (d.additions + d.deletions) > 100);
    if (largeChanges.length > 0) {
      changes.push(`${largeChanges.length} file(s) with significant changes (>100 lines)`);
    }

    return changes;
  }

  /**
   * Extract module names from affected nodes
   */
  private findAffectedModules(nodes: GraphNode[]): string[] {
    const modules = new Set<string>();

    for (const node of nodes) {
      if (node.path) {
        // Extract module name from path (e.g., src/utils.ts -> src, packages/core/src/changes/file.ts -> changes)
        const parts = node.path.split('/');
        if (parts.length >= 2) {
          modules.add(parts[parts.length - 2]);
        }
      }
    }

    return Array.from(modules);
  }

  /**
   * Find nodes that depend on the affected nodes
   */
  private findDependentNodes(nodes: GraphNode[]): string[] {
    const dependents = new Set<string>();

    for (const node of nodes) {
      const neighbors = this.graph.getNeighbors(node.id);
      // Incoming neighbors are nodes that depend on this node
      for (const incoming of neighbors.incoming) {
        dependents.add(incoming.name);
      }
    }

    return Array.from(dependents);
  }

  /**
   * Identify critical zones with high dependency counts
   */
  private identifyRegressionZones(nodes: GraphNode[]): string[] {
    const zones: string[] = [];

    for (const node of nodes) {
      const neighbors = this.graph.getNeighbors(node.id);
      // If a node has many incoming dependencies, it's a critical zone
      if (neighbors.incoming.length > 5) {
        zones.push(`${node.name} (${neighbors.incoming.length} dependents)`);
      }
    }

    return zones;
  }

  /**
   * Assess risk level based on change characteristics
   */
  private assessRiskLevel(diffs: FileDiff[], nodes: GraphNode[]): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Factor 1: Number of files changed
    if (diffs.length > 10) riskScore += 2;
    else if (diffs.length > 5) riskScore += 1;

    // Factor 2: Size of changes
    const totalChanges = diffs.reduce((sum, d) => sum + d.additions + d.deletions, 0);
    if (totalChanges > 500) riskScore += 2;
    else if (totalChanges > 200) riskScore += 1;

    // Factor 3: Deleted files
    const deletedCount = diffs.filter(d => d.status === 'deleted').length;
    if (deletedCount > 0) riskScore += 1;

    // Factor 4: Number of affected nodes with dependencies
    const nodesWithDeps = nodes.filter(n => {
      const neighbors = this.graph.getNeighbors(n.id);
      return neighbors.incoming.length > 0;
    });
    if (nodesWithDeps.length > 5) riskScore += 2;
    else if (nodesWithDeps.length > 2) riskScore += 1;

    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Generate overview using LLM
   */
  private async generateOverview(diffs: FileDiff[], modules: string[]): Promise<string> {
    if (!this.llmClient) {
      return this.generateBasicOverview(diffs);
    }

    const diffSummary = diffs.map(d =>
      `${d.status}: ${d.path} (+${d.additions}/-${d.deletions})`
    ).join('\n');

    const prompt = `Analyze these code changes and provide a concise 2-3 sentence overview:

Changes:
${diffSummary}

Affected modules: ${modules.join(', ')}

Provide a high-level summary of what changed and why it matters.`;

    try {
      const response = await this.llmClient.complete({
        prompt,
        systemPrompt: 'You are a code review expert. Provide concise, technical summaries of code changes.',
        maxTokens: 200
      });

      return response.content.trim();
    } catch {
      return this.generateBasicOverview(diffs);
    }
  }

  /**
   * Generate basic overview without LLM
   */
  private generateBasicOverview(diffs: FileDiff[]): string {
    const added = diffs.filter(d => d.status === 'added').length;
    const modified = diffs.filter(d => d.status === 'modified').length;
    const deleted = diffs.filter(d => d.status === 'deleted').length;

    return `Changed ${diffs.length} file(s): ${added} added, ${modified} modified, ${deleted} deleted.`;
  }

  /**
   * Generate risk assessment using LLM
   */
  private async generateRiskAssessment(
    diffs: FileDiff[],
    directlyAffected: string[],
    potentiallyAffected: string[]
  ): Promise<string> {
    if (!this.llmClient) {
      return this.generateBasicRiskAssessment(diffs, directlyAffected, potentiallyAffected);
    }

    const diffSummary = diffs.map(d =>
      `${d.status}: ${d.path} (+${d.additions}/-${d.deletions})`
    ).join('\n');

    const prompt = `Analyze the risk of these code changes:

Changes:
${diffSummary}

Directly affected: ${directlyAffected.join(', ')}
Potentially affected: ${potentiallyAffected.join(', ')}

Provide a brief risk assessment focusing on potential issues and testing recommendations.`;

    try {
      const response = await this.llmClient.complete({
        prompt,
        systemPrompt: 'You are a software architect. Assess risks in code changes.',
        maxTokens: 300
      });

      return response.content.trim();
    } catch {
      return this.generateBasicRiskAssessment(diffs, directlyAffected, potentiallyAffected);
    }
  }

  /**
   * Generate basic risk assessment without LLM
   */
  private generateBasicRiskAssessment(
    diffs: FileDiff[],
    directlyAffected: string[],
    potentiallyAffected: string[]
  ): string {
    const totalChanges = diffs.reduce((sum, d) => sum + d.additions + d.deletions, 0);

    let assessment = `Total changes: ${totalChanges} lines across ${diffs.length} files. `;

    if (potentiallyAffected.length > 0) {
      assessment += `${potentiallyAffected.length} dependent module(s) may be affected. `;
    }

    if (diffs.some(d => d.status === 'deleted')) {
      assessment += 'File deletions require careful review of dependencies. ';
    }

    assessment += 'Recommend thorough testing of affected modules.';

    return assessment;
  }
}
