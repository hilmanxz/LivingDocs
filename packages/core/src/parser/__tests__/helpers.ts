import { readFileSync } from 'fs';
import { join } from 'path';

export const FIXTURES_DIR = join(import.meta.dirname, '__fixtures__');

export const SAMPLE_FILE = join(FIXTURES_DIR, 'sample.ts');

export function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}
