import { describe, it, expect, vi } from 'vitest';
import { LLMClient } from '../LLMClient.js';
import { ContextBuilder } from '../ContextBuilder.js';
import { Summarizer } from '../Summarizer.js';
import type { ParsedFile, LLMConfig } from '@livingdocs/shared';

// Mock fetch
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      choices: [{ message: { content: '{"summary":"Auth module","purpose":"Handles auth","keyExports":["login"],"dependencies":[]}' } }],
      content: [{ text: '{"summary":"Auth module","purpose":"Handles auth","keyExports":["login"],"dependencies":[]}' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, input_tokens: 10, output_tokens: 20 },
    }),
  } as any)
);

const sampleFile: ParsedFile = {
  filePath: 'src/auth.ts',
  content: 'export function login() { return true; }',
  imports: [],
  exports: [{ type: 'named', name: 'login', location: { start: { line: 1, column: 1 }, end: { line: 1, column: 40 } } }],
  symbols: [{ name: 'login', kind: 'function', exported: true, location: { start: { line: 1, column: 1 }, end: { line: 1, column: 40 } } }],
  lineCount: 1,
};

describe('LLMClient', () => {
  const config: LLMConfig = { provider: 'openai', apiKey: 'test-key' };

  it('should call OpenAI API successfully', async () => {
    const client = new LLMClient(config);
    const result = await client.complete({ prompt: 'hello' });
    expect(result.content).toBeDefined();
    expect(global.fetch).toHaveBeenCalled();
  });
});

describe('ContextBuilder', () => {
  const builder = new ContextBuilder();

  it('should build valid file context', () => {
    const context = builder.buildFileContext('src/auth.ts', sampleFile);
    expect(context.files[0].path).toBe('src/auth.ts');
    expect(context.symbols[0].name).toBe('login');
  });

  it('should build prompt string', () => {
    const context = builder.buildFileContext('src/auth.ts', sampleFile);
    const prompt = builder.buildPrompt(context, 'Explain this file');
    expect(prompt).toContain('## Files');
    expect(prompt).toContain('src/auth.ts');
    expect(prompt).toContain('Explain this file');
  });
});

describe('Summarizer', () => {
  const config: LLMConfig = { provider: 'openai', apiKey: 'test-key' };
  const client = new LLMClient(config);
  const summarizer = new Summarizer(client);

  it('should summarize a file using LLM', async () => {
    const summary = await summarizer.summarizeFile('src/auth.ts', sampleFile);
    expect(summary.filePath).toBe('src/auth.ts');
    expect(summary.summary).toBe('Auth module');
    expect(summary.purpose).toBe('Handles auth');
  });
});
