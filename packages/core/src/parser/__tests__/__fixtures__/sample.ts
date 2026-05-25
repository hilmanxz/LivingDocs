// Fixture: sample.ts
// A representative TypeScript file with common patterns

import fs from 'fs';
import { join, resolve as resolvePath } from 'path';
import type { ParsedFile } from '@livingdocs/shared';
import * as utils from './utils.js';

export const VERSION = '1.0.0';
export const MAX_RETRY = 3;

export type Status = 'active' | 'inactive' | 'pending';

export interface Config {
  host: string;
  port: number;
  timeout?: number;
}

export class FileService {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  readFile(name: string): string {
    return fs.readFileSync(join(this.root, name), 'utf-8');
  }

  listFiles(): string[] {
    return fs.readdirSync(this.root);
  }
}

export function parseConfig(raw: string): Config {
  return JSON.parse(raw) as Config;
}

export async function loadFile(filePath: string): Promise<ParsedFile | null> {
  try {
    const content = fs.readFileSync(resolvePath(filePath), 'utf-8');
    return null; // Simplified for fixture
  } catch {
    return null;
  }
}

function internalHelper(x: number): number {
  return x * 2;
}

export enum Direction {
  Up = 'UP',
  Down = 'DOWN',
  Left = 'LEFT',
  Right = 'RIGHT',
}

export default FileService;
