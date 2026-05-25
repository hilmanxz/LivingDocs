import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { traceFlow } from '../trace-flow.js';

describe('traceFlow', () => {
  const testDir = join(process.cwd(), '.test-mcp-trace-flow');
  const testFile = join(testDir, 'service.ts');

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });

    // Create a test file with dependencies
    const content = `
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Logger } from './logger.js';
import { createLogger } from './logger.js';
import { validateConfig } from './validators.js';

export async function processFile(filePath: string): Promise<void> {
  const logger = createLogger('processor');
  const content = await readFile(filePath, 'utf-8');
  validateConfig(content);
  logger.info('File processed');
}

export interface ProcessOptions {
  timeout?: number;
}
`;

    writeFileSync(testFile, content);
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should trace outgoing dependencies', async () => {
    const result = await traceFlow({
      filePath: testFile,
      direction: 'outgoing',
    });

    expect(result.content).toBeDefined();
    const text = result.content[0].text;

    expect(text).toContain('Dependency Flow');
    expect(text).toContain('Outgoing');
    expect(text).toContain('Dependencies');
  });

  it('should identify external packages in outgoing flow', async () => {
    const result = await traceFlow({
      filePath: testFile,
      direction: 'outgoing',
    });

    const text = result.content[0].text;
    expect(text).toContain('fs/promises');
    expect(text).toContain('path');
  });

  it('should identify internal modules in outgoing flow', async () => {
    const result = await traceFlow({
      filePath: testFile,
      direction: 'outgoing',
    });

    const text = result.content[0].text;
    expect(text).toContain('./logger.js');
    expect(text).toContain('./validators.js');
  });

  it('should show exported symbols for incoming flow', async () => {
    const result = await traceFlow({
      filePath: testFile,
      direction: 'incoming',
    });

    const text = result.content[0].text;
    expect(text).toContain('Exported Symbols');
    expect(text).toContain('processFile');
    expect(text).toContain('ProcessOptions');
  });

  it('should provide dependency summary', async () => {
    const result = await traceFlow({
      filePath: testFile,
      direction: 'outgoing',
    });

    const text = result.content[0].text;
    expect(text).toContain('Summary');
    expect(text).toContain('Total dependencies');
  });

  it('should handle non-existent files gracefully', async () => {
    const result = await traceFlow({
      filePath: '/non/existent/file.ts',
      direction: 'outgoing',
    });

    const text = result.content[0].text;
    expect(text).toContain('Error');
    expect(text).toContain('not found');
  });

  it('should support depth parameter', async () => {
    const result = await traceFlow({
      filePath: testFile,
      direction: 'outgoing',
      depth: 3,
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBeTruthy();
  });
});
