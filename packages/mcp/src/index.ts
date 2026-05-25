#!/usr/bin/env node
import { startServer } from './server.js';

// Export server creation for programmatic use
export { createMcpServer, startServer } from './server.js';

// Start server when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
