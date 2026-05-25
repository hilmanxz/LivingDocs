#!/usr/bin/env node
import('../dist/index.js').catch((error) => {
  console.error('Failed to start LivingDocs MCP server:', error);
  process.exit(1);
});
