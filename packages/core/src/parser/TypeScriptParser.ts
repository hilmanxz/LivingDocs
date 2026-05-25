import ts from 'typescript';
import { readFileSync } from 'fs';
import type {
  ParsedFile,
  Import,
  Export,
  Symbol as CodeSymbol,
  ImportSpecifier,
  SourceLocation,
} from '@livingdocs/shared';

/**
 * TypeScriptParser uses the TypeScript Compiler API to parse TypeScript files
 * and extract imports, exports, and symbols.
 */
export class TypeScriptParser {
  private cache = new Map<string, ts.SourceFile>();

  /**
   * Get or create a SourceFile for the given path
   */
  private getSourceFile(filePath: string): ts.SourceFile {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }
    const content = readFileSync(filePath, 'utf-8');
    const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    this.cache.set(filePath, sf);
    return sf;
  }

  /**
   * Get source location for a node
   */
  private getLocation(sourceFile: ts.SourceFile, node: ts.Node): SourceLocation {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    return {
      start: { line: start.line + 1, column: start.character },
      end: { line: end.line + 1, column: end.character },
    };
  }

  /**
   * Parse a TypeScript file and return structured information
   */
  parseFile(filePath: string): ParsedFile {
    const sourceFile = this.getSourceFile(filePath);
    return {
      filePath,
      content: sourceFile.text,
      imports: this.extractImports(filePath),
      exports: this.extractExports(filePath),
      symbols: this.extractSymbols(filePath),
      lineCount: sourceFile.getLineStarts().length,
    };
  }

  /**
   * Extract all import declarations from a file
   */
  extractImports(filePath: string): Import[] {
    const sourceFile = this.getSourceFile(filePath);
    const imports: Import[] = [];

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        const source = (node.moduleSpecifier as ts.StringLiteral).text;
        const specifiers: ImportSpecifier[] = [];

        if (node.importClause) {
          // Default import: import X from 'module'
          if (node.importClause.name) {
            specifiers.push({ type: 'default', name: node.importClause.name.text });
          }

          // Namespace or named imports
          const { namedBindings } = node.importClause;
          if (namedBindings) {
            if (ts.isNamespaceImport(namedBindings)) {
              // import * as X from 'module'
              specifiers.push({ type: 'namespace', name: namedBindings.name.text });
            } else if (ts.isNamedImports(namedBindings)) {
              // import { a, b as c } from 'module'
              for (const element of namedBindings.elements) {
                specifiers.push({
                  type: 'named',
                  name: element.name.text,
                  alias: element.propertyName?.text,
                });
              }
            }
          }
        }

        imports.push({
          source,
          specifiers,
          isTypeOnly: node.importClause?.isTypeOnly ?? false,
          location: this.getLocation(sourceFile, node),
        });
      }
    });

    return imports;
  }

  /**
   * Extract all export declarations from a file
   */
  extractExports(filePath: string): Export[] {
    const sourceFile = this.getSourceFile(filePath);
    const exports: Export[] = [];

    ts.forEachChild(sourceFile, (node) => {
      // export default X
      if (ts.isExportAssignment(node)) {
        exports.push({
          type: 'default',
          location: this.getLocation(sourceFile, node),
        });
      }
      // export * from 'x' or export { a, b } from 'x' or export { a, b }
      else if (ts.isExportDeclaration(node)) {
        if (node.exportClause) {
          // export { a, b } or export { a, b } from 'x'
          if (ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              exports.push({
                type: 'named',
                name: element.name.text,
                source: node.moduleSpecifier
                  ? (node.moduleSpecifier as ts.StringLiteral).text
                  : undefined,
                location: this.getLocation(sourceFile, element),
              });
            }
          }
        } else {
          // export * from 'x'
          exports.push({
            type: 'all',
            source: node.moduleSpecifier
              ? (node.moduleSpecifier as ts.StringLiteral).text
              : undefined,
            location: this.getLocation(sourceFile, node),
          });
        }
      }
      // export function f() {}, export class X {}, export const x = ..., export enum E {}
      else if (
        ts.canHaveModifiers(node) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          exports.push({
            type: 'named',
            name: node.name.text,
            location: this.getLocation(sourceFile, node),
          });
        } else if (ts.isClassDeclaration(node) && node.name) {
          exports.push({
            type: 'named',
            name: node.name.text,
            location: this.getLocation(sourceFile, node),
          });
        } else if (ts.isInterfaceDeclaration(node)) {
          exports.push({
            type: 'named',
            name: node.name.text,
            location: this.getLocation(sourceFile, node),
          });
        } else if (ts.isTypeAliasDeclaration(node)) {
          exports.push({
            type: 'named',
            name: node.name.text,
            location: this.getLocation(sourceFile, node),
          });
        } else if (ts.isEnumDeclaration(node)) {
          exports.push({
            type: 'named',
            name: node.name.text,
            location: this.getLocation(sourceFile, node),
          });
        } else if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              exports.push({
                type: 'named',
                name: decl.name.text,
                location: this.getLocation(sourceFile, node),
              });
            }
          }
        }
      }
    });

    return exports;
  }

  /**
   * Extract all symbols (functions, classes, interfaces, types, variables) from a file
   */
  extractSymbols(filePath: string): CodeSymbol[] {
    const sourceFile = this.getSourceFile(filePath);
    const symbols: CodeSymbol[] = [];

    const isExported = (node: ts.Node): boolean => {
      if (!ts.canHaveModifiers(node)) return false;
      const modifiers = ts.getModifiers(node);
      return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    };

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        symbols.push({
          name: node.name.text,
          kind: 'function',
          exported: isExported(node),
          location: this.getLocation(sourceFile, node),
          signature: this.getFunctionSignature(sourceFile, node),
        });
      } else if (ts.isClassDeclaration(node) && node.name) {
        symbols.push({
          name: node.name.text,
          kind: 'class',
          exported: isExported(node),
          location: this.getLocation(sourceFile, node),
        });
      } else if (ts.isInterfaceDeclaration(node)) {
        symbols.push({
          name: node.name.text,
          kind: 'interface',
          exported: isExported(node),
          location: this.getLocation(sourceFile, node),
        });
      } else if (ts.isTypeAliasDeclaration(node)) {
        symbols.push({
          name: node.name.text,
          kind: 'type',
          exported: isExported(node),
          location: this.getLocation(sourceFile, node),
        });
      } else if (ts.isVariableStatement(node)) {
        const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            symbols.push({
              name: decl.name.text,
              kind: isConst ? 'const' : 'variable',
              exported: isExported(node),
              location: this.getLocation(sourceFile, node),
            });
          }
        }
      } else if (ts.isEnumDeclaration(node)) {
        symbols.push({
          name: node.name.text,
          kind: 'enum',
          exported: isExported(node),
          location: this.getLocation(sourceFile, node),
        });
      }
    });

    return symbols;
  }

  /**
   * Get function signature as string
   */
  private getFunctionSignature(sourceFile: ts.SourceFile, node: ts.FunctionDeclaration): string {
    const text = node.getText(sourceFile);
    const bodyIndex = text.indexOf('{');
    return bodyIndex > 0 ? text.slice(0, bodyIndex).trim() : text.split('\n')[0];
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
