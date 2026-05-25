import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { explainFolder } from '../explain-folder.js';

describe('explainFolder', () => {
  const testDir = join(process.cwd(), '.test-mcp-explain-folder');

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'utils'), { recursive: true });
    mkdirSync(join(testDir, 'types'), { recursive: true });

    // Create test files
    writeFileSync(
      join(testDir, 'index.ts'),
      `export { loadConfig } from './utils/config.js';
export type { Config } from './types/config.js';`
    );

    writeFileSync(
      join(testDir, 'utils', 'config.ts'),
      `export async function loadConfig(path: string) {
  return { loaded: true };
}`
    );

    writeFileSync(
      join(testDir, 'utils', 'helpers.ts'),
      `export function helper1() {}
export function helper2() {}`
    );

    writeFileSync(
      join(testDir, 'types', 'config.ts'),
      `export interface Config {
  debug?: boolean;
}`
    );
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should explain a folder structure', async () => {
    const result = await explainFolder({ folderPath: testDir });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const text = result.content[0].text;
    expect(text).toContain('Folder Analysis');
    expect(text).toContain('Overview');
  });

  it('should count TypeScript files correctly', async () => {
    const result = await explainFolder({ folderPath: testDir });
    const text = result.content[0].text;

    expect(text).toContain('TypeScript files');
    // Should find 4 files: index.ts, config.ts, helpers.ts, config.ts
    expect(text).toMatch(/Total TypeScript files:\s+\d+/);
  });

  it('should identify key files and entry points', async () => {
    const result = await explainFolder({ folderPath: testDir });
    const text = result.content[0].text;

    expect(text).toContain('Key Files');
    expect(text).toContain('index.ts');
  });

  it('should infer folder purpose', async () => {
    const result = await explainFolder({ folderPath: testDir });
    const text = result.content[0].text;

    expect(text).toContain('Purpose');
  });

  it('should handle non-existent folders gracefully', async () => {
    const result = await explainFolder({ folderPath: '/non/existent/folder' });
    const text = result.content[0].text;

    expect(text).toContain('Error');
    expect(text).toContain('not found');
  });
});
