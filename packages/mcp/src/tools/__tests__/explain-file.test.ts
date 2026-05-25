import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { explainFile } from '../explain-file.js';

describe('explainFile', () => {
  const testDir = join(process.cwd(), '.test-mcp-explain-file');
  const testFile = join(testDir, 'test.ts');

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });

    // Create a test TypeScript file
    const content = `
import { readFile } from 'fs/promises';
import type { Config } from './config.js';

/**
 * Reads configuration from a file
 */
export async function loadConfig(path: string): Promise<Config> {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

/**
 * Internal helper function
 */
function parseConfig(raw: string): Config {
  return JSON.parse(raw);
}

export interface ConfigOptions {
  debug?: boolean;
  timeout?: number;
}
`;

    writeFileSync(testFile, content);
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should explain a file with exports and imports', async () => {
    const result = await explainFile({ filePath: testFile });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const text = result.content[0].text;
    expect(text).toContain('File Analysis');
    expect(text).toContain('test.ts');
    expect(text).toContain('Exports');
    expect(text).toContain('loadConfig');
    expect(text).toContain('ConfigOptions');
  });

  it('should identify external and internal dependencies', async () => {
    const result = await explainFile({ filePath: testFile });
    const text = result.content[0].text;

    expect(text).toContain('Dependencies');
    expect(text).toContain('fs/promises');
    expect(text).toContain('./config.js');
  });

  it('should distinguish exported and internal symbols', async () => {
    const result = await explainFile({ filePath: testFile });
    const text = result.content[0].text;

    expect(text).toContain('Exported');
    expect(text).toContain('loadConfig');
    expect(text).toContain('Internal');
    expect(text).toContain('parseConfig');
  });

  it('should handle non-existent files gracefully', async () => {
    const result = await explainFile({ filePath: '/non/existent/file.ts' });
    const text = result.content[0].text;

    expect(text).toContain('Error');
    expect(text).toContain('not found');
  });

  it('should infer file purpose based on structure', async () => {
    const result = await explainFile({ filePath: testFile });
    const text = result.content[0].text;

    expect(text).toContain('Purpose');
    // Should identify it as exporting utility functions
    expect(text.toLowerCase()).toMatch(/utility|export/i);
  });
});
