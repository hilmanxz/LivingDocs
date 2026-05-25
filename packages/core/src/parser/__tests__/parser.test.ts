import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { TypeScriptParser } from '../TypeScriptParser.js';
import { ProjectAnalyzer } from '../ProjectAnalyzer.js';
import { SAMPLE_FILE } from './helpers.js';

describe('TypeScriptParser', () => {
  let parser: TypeScriptParser;

  beforeAll(() => {
    parser = new TypeScriptParser();
  });

  describe('parseFile', () => {
    it('should parse a TypeScript file completely', () => {
      const result = parser.parseFile(SAMPLE_FILE);

      expect(result).toBeDefined();
      expect(result.filePath).toBe(SAMPLE_FILE);
      expect(result.content).toContain('export class FileService');
      expect(result.imports.length).toBeGreaterThan(0);
      expect(result.exports.length).toBeGreaterThan(0);
      expect(result.symbols.length).toBeGreaterThan(0);
      expect(result.lineCount).toBeGreaterThan(0);
    });
  });

  describe('extractImports', () => {
    it('should extract default imports', () => {
      const imports = parser.extractImports(SAMPLE_FILE);
      const fsImport = imports.find((imp) => imp.source === 'fs');

      expect(fsImport).toBeDefined();
      expect(fsImport?.specifiers).toHaveLength(1);
      expect(fsImport?.specifiers[0].type).toBe('default');
      expect(fsImport?.specifiers[0].name).toBe('fs');
    });

    it('should extract named imports', () => {
      const imports = parser.extractImports(SAMPLE_FILE);
      const pathImport = imports.find((imp) => imp.source === 'path');

      expect(pathImport).toBeDefined();
      expect(pathImport?.specifiers.length).toBeGreaterThanOrEqual(2);

      const joinSpec = pathImport?.specifiers.find((s) => s.name === 'join');
      expect(joinSpec?.type).toBe('named');

      const resolveSpec = pathImport?.specifiers.find((s) => s.name === 'resolvePath');
      expect(resolveSpec?.type).toBe('named');
      expect(resolveSpec?.alias).toBe('resolve');
    });

    it('should extract type-only imports', () => {
      const imports = parser.extractImports(SAMPLE_FILE);
      const typeImport = imports.find((imp) => imp.source === '@livingdocs/shared');

      expect(typeImport).toBeDefined();
      expect(typeImport?.isTypeOnly).toBe(true);
    });

    it('should extract namespace imports', () => {
      const imports = parser.extractImports(SAMPLE_FILE);
      const namespaceImport = imports.find((imp) => imp.source === './utils.js');

      expect(namespaceImport).toBeDefined();
      expect(namespaceImport?.specifiers).toHaveLength(1);
      expect(namespaceImport?.specifiers[0].type).toBe('namespace');
      expect(namespaceImport?.specifiers[0].name).toBe('utils');
    });
  });

  describe('extractExports', () => {
    it('should extract named constant exports', () => {
      const exports = parser.extractExports(SAMPLE_FILE);

      const versionExport = exports.find((exp) => exp.name === 'VERSION');
      expect(versionExport).toBeDefined();
      expect(versionExport?.type).toBe('named');

      const maxRetryExport = exports.find((exp) => exp.name === 'MAX_RETRY');
      expect(maxRetryExport).toBeDefined();
    });

    it('should extract type exports', () => {
      const exports = parser.extractExports(SAMPLE_FILE);

      const statusExport = exports.find((exp) => exp.name === 'Status');
      expect(statusExport).toBeDefined();
      expect(statusExport?.type).toBe('named');
    });

    it('should extract interface exports', () => {
      const exports = parser.extractExports(SAMPLE_FILE);

      const configExport = exports.find((exp) => exp.name === 'Config');
      expect(configExport).toBeDefined();
      expect(configExport?.type).toBe('named');
    });

    it('should extract class exports', () => {
      const exports = parser.extractExports(SAMPLE_FILE);

      const classExport = exports.find((exp) => exp.name === 'FileService');
      expect(classExport).toBeDefined();
      expect(classExport?.type).toBe('named');
    });

    it('should extract function exports', () => {
      const exports = parser.extractExports(SAMPLE_FILE);

      const parseConfigExport = exports.find((exp) => exp.name === 'parseConfig');
      expect(parseConfigExport).toBeDefined();

      const loadFileExport = exports.find((exp) => exp.name === 'loadFile');
      expect(loadFileExport).toBeDefined();
    });

    it('should extract enum exports', () => {
      const exports = parser.extractExports(SAMPLE_FILE);

      const enumExport = exports.find((exp) => exp.name === 'Direction');
      expect(enumExport).toBeDefined();
      expect(enumExport?.type).toBe('named');
    });

    it('should extract default export', () => {
      const exports = parser.extractExports(SAMPLE_FILE);

      const defaultExport = exports.find((exp) => exp.type === 'default');
      expect(defaultExport).toBeDefined();
    });
  });

  describe('extractSymbols', () => {
    it('should extract exported constants', () => {
      const symbols = parser.extractSymbols(SAMPLE_FILE);

      const versionSymbol = symbols.find((s) => s.name === 'VERSION');
      expect(versionSymbol).toBeDefined();
      expect(versionSymbol?.kind).toBe('const');
      expect(versionSymbol?.exported).toBe(true);
    });

    it('should extract types', () => {
      const symbols = parser.extractSymbols(SAMPLE_FILE);

      const statusSymbol = symbols.find((s) => s.name === 'Status');
      expect(statusSymbol).toBeDefined();
      expect(statusSymbol?.kind).toBe('type');
      expect(statusSymbol?.exported).toBe(true);
    });

    it('should extract interfaces', () => {
      const symbols = parser.extractSymbols(SAMPLE_FILE);

      const configSymbol = symbols.find((s) => s.name === 'Config');
      expect(configSymbol).toBeDefined();
      expect(configSymbol?.kind).toBe('interface');
      expect(configSymbol?.exported).toBe(true);
    });

    it('should extract classes', () => {
      const symbols = parser.extractSymbols(SAMPLE_FILE);

      const classSymbol = symbols.find((s) => s.name === 'FileService');
      expect(classSymbol).toBeDefined();
      expect(classSymbol?.kind).toBe('class');
      expect(classSymbol?.exported).toBe(true);
    });

    it('should extract exported functions', () => {
      const symbols = parser.extractSymbols(SAMPLE_FILE);

      const parseConfigSymbol = symbols.find((s) => s.name === 'parseConfig');
      expect(parseConfigSymbol).toBeDefined();
      expect(parseConfigSymbol?.kind).toBe('function');
      expect(parseConfigSymbol?.exported).toBe(true);
      expect(parseConfigSymbol?.signature).toContain('parseConfig');
    });

    it('should extract non-exported functions', () => {
      const symbols = parser.extractSymbols(SAMPLE_FILE);

      const internalSymbol = symbols.find((s) => s.name === 'internalHelper');
      expect(internalSymbol).toBeDefined();
      expect(internalSymbol?.kind).toBe('function');
      expect(internalSymbol?.exported).toBe(false);
    });

    it('should extract enums', () => {
      const symbols = parser.extractSymbols(SAMPLE_FILE);

      const enumSymbol = symbols.find((s) => s.name === 'Direction');
      expect(enumSymbol).toBeDefined();
      expect(enumSymbol?.kind).toBe('enum');
      expect(enumSymbol?.exported).toBe(true);
    });

    it('should include location information', () => {
      const symbols = parser.extractSymbols(SAMPLE_FILE);

      const symbol = symbols[0];
      expect(symbol.location).toBeDefined();
      expect(symbol.location.start.line).toBeGreaterThan(0);
      expect(symbol.location.end.line).toBeGreaterThanOrEqual(symbol.location.start.line);
    });
  });
});

describe('ProjectAnalyzer', () => {
  let analyzer: ProjectAnalyzer;

  beforeAll(() => {
    analyzer = new ProjectAnalyzer();
  });

  describe('loadProject', () => {
    it('should load a project and find TypeScript files', () => {
      // Scan the parser directory (parent of __tests__)
      const projectRoot = join(import.meta.dirname, '..');
      analyzer.loadProject(projectRoot);

      const files = analyzer.getAllFiles();
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.endsWith('.ts'))).toBe(true);
    });

    it('should exclude node_modules and build directories', () => {
      // Scan the whole LivingDocs root
      const projectRoot = join(import.meta.dirname, '..', '..', '..', '..', '..');
      analyzer.loadProject(projectRoot);

      const files = analyzer.getAllFiles();
      expect(files.every((f) => !f.includes('node_modules'))).toBe(true);
      expect(files.every((f) => !f.includes('dist'))).toBe(true);
    });
  });

  describe('analyzeFile', () => {
    it('should analyze a file and return metrics', () => {
      const analysis = analyzer.analyzeFile(SAMPLE_FILE);

      expect(analysis).toBeDefined();
      expect(analysis.filePath).toBe(SAMPLE_FILE);
      expect(analysis.absolutePath).toContain('sample.ts');
      expect(analysis.parsedFile).toBeDefined();
      expect(analysis.dependencies.length).toBeGreaterThan(0);
      expect(analysis.metrics.importCount).toBeGreaterThan(0);
      expect(analysis.metrics.exportCount).toBeGreaterThan(0);
      expect(analysis.metrics.symbolCount).toBeGreaterThan(0);
      expect(analysis.metrics.lineCount).toBeGreaterThan(0);
    });

    it('should extract dependencies from imports', () => {
      const analysis = analyzer.analyzeFile(SAMPLE_FILE);

      expect(analysis.dependencies).toContain('fs');
      expect(analysis.dependencies).toContain('path');
      expect(analysis.dependencies).toContain('@livingdocs/shared');
    });

    it('should match metrics with parsed data', () => {
      const analysis = analyzer.analyzeFile(SAMPLE_FILE);

      expect(analysis.metrics.importCount).toBe(analysis.parsedFile.imports.length);
      expect(analysis.metrics.exportCount).toBe(analysis.parsedFile.exports.length);
      expect(analysis.metrics.symbolCount).toBe(analysis.parsedFile.symbols.length);
      expect(analysis.metrics.lineCount).toBe(analysis.parsedFile.lineCount);
    });
  });

  describe('getAllFiles', () => {
    it('should return all discovered TypeScript files', () => {
      const projectRoot = join(import.meta.dirname, '..');
      analyzer.loadProject(projectRoot);

      const files = analyzer.getAllFiles();
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.endsWith('.ts') || f.endsWith('.tsx'))).toBe(true);
    });
  });
});
