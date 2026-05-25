import type { CommandHandler, McpOptions } from '../types.js';
import { createLogger } from '../logger.js';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Start the LivingDocs MCP server.
 *
 * This command starts the Model Context Protocol server that exposes
 * LivingDocs tools to AI agents like Claude Desktop, Cursor, and Continue.dev.
 */
export const mcp: CommandHandler<McpOptions> = async (options) => {
  const logger = createLogger(options);

  logger.header('Starting LivingDocs MCP Server');

  try {
    // Find the MCP package
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const mcpPackagePath = resolve(__dirname, '../../../mcp/dist/index.js');

    logger.info('MCP server starting...');
    logger.info('');
    logger.info('The server will communicate via stdio.');
    logger.info('Configure your AI agent to connect to this server.');
    logger.info('');

    // Start the MCP server as a child process
    const mcpProcess = spawn('node', [mcpPackagePath], {
      stdio: 'inherit',
      env: process.env,
    });

    mcpProcess.on('error', (error) => {
      logger.error(`Failed to start MCP server: ${error.message}`);
      process.exit(1);
    });

    mcpProcess.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`MCP server exited with code ${code}`);
        process.exit(code || 1);
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('\nShutting down MCP server...');
      mcpProcess.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      mcpProcess.kill('SIGTERM');
      process.exit(0);
    });
  } catch (error) {
    logger.error(`\nMCP server failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};
