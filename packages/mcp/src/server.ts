import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod';

import { explainFile, explainFileSchema } from './tools/explain-file.js';
import { explainFolder, explainFolderSchema } from './tools/explain-folder.js';
import { traceFlow, traceFlowSchema } from './tools/trace-flow.js';
import { detectImpact, detectImpactSchema } from './tools/detect-impact.js';
import { summarizeCommit, summarizeCommitSchema } from './tools/summarize-commit.js';
import { generateDocs, generateDocsSchema } from './tools/generate-docs.js';

/**
 * Create and configure the MCP server for LivingDocs
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'livingdocs',
    version: '0.1.0',
  });

  // Register explain_file tool
  server.tool(
    'explain_file',
    {
      description: 'Explain a file\'s purpose, exports, dependencies, and structure',
      inputSchema: explainFileSchema,
    },
    async (input) => {
      return explainFile(input as any);
    }
  );

  // Register explain_folder tool
  server.tool(
    'explain_folder',
    {
      description: 'Explain a folder\'s purpose, key files, and module structure',
      inputSchema: explainFolderSchema,
    },
    async (input) => {
      return explainFolder(input as any);
    }
  );

  // Register trace_flow tool
  server.tool(
    'trace_flow',
    {
      description: 'Trace dependency flow from a file (incoming or outgoing dependencies)',
      inputSchema: traceFlowSchema,
    },
    async (input) => {
      return traceFlow(input as any);
    }
  );

  // Register detect_impact tool
  server.tool(
    'detect_impact',
    {
      description: 'Detect the impact of changing a file - returns affected services, APIs, and potential regression zones',
      inputSchema: detectImpactSchema,
    },
    async (input) => {
      return detectImpact(input as any);
    }
  );

  // Register summarize_commit tool
  server.tool(
    'summarize_commit',
    {
      description: 'Summarize what a git commit changed architecturally',
      inputSchema: summarizeCommitSchema,
    },
    async (input) => {
      return summarizeCommit(input as any);
    }
  );

  // Register generate_docs tool
  server.tool(
    'generate_docs',
    {
      description: 'Generate documentation for a path (README, architecture, onboarding, or API docs)',
      inputSchema: generateDocsSchema,
    },
    async (input) => {
      return generateDocs(input as any);
    }
  );

  return server;
}

/**
 * Start the MCP server with stdio transport
 */
export async function startServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio protocol
  console.error('LivingDocs MCP server started');
}
