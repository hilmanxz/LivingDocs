import { describe, it, expect, beforeEach } from 'vitest';
import { DiffAnalyzer } from './DiffAnalyzer.js';

describe('DiffAnalyzer', () => {
  let analyzer: DiffAnalyzer;

  beforeEach(() => {
    analyzer = new DiffAnalyzer();
  });

  describe('parseDiff', () => {
    it('should parse a simple modified file diff', () => {
      const diffOutput = `diff --git a/src/utils.ts b/src/utils.ts
index abc1234..def5678 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,6 +10,8 @@ export function helper() {
   const a = 1;
   const b = 2;
+  const c = 3;
+  const d = 4;
   return a + b;
 }
`;

      const result = analyzer.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/utils.ts');
      expect(result[0].status).toBe('modified');
      expect(result[0].additions).toBe(2);
      expect(result[0].deletions).toBe(0);
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0].oldStart).toBe(10);
      expect(result[0].hunks[0].oldLines).toBe(6);
      expect(result[0].hunks[0].newStart).toBe(10);
      expect(result[0].hunks[0].newLines).toBe(8);
    });

    it('should parse a new file diff', () => {
      const diffOutput = `diff --git a/src/newFile.ts b/src/newFile.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/newFile.ts
@@ -0,0 +1,5 @@
+export function newFunction() {
+  return 'hello';
+}
+
+export const VALUE = 42;
`;

      const result = analyzer.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/newFile.ts');
      expect(result[0].status).toBe('added');
      expect(result[0].additions).toBe(5);
      expect(result[0].deletions).toBe(0);
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0].oldStart).toBe(0);
      expect(result[0].hunks[0].oldLines).toBe(0);
      expect(result[0].hunks[0].newStart).toBe(1);
      expect(result[0].hunks[0].newLines).toBe(5);
    });

    it('should parse a deleted file diff', () => {
      const diffOutput = `diff --git a/src/oldFile.ts b/src/oldFile.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/oldFile.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function oldFunction() {
-  return 'goodbye';
-}
`;

      const result = analyzer.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/oldFile.ts');
      expect(result[0].status).toBe('deleted');
      expect(result[0].additions).toBe(0);
      expect(result[0].deletions).toBe(3);
      expect(result[0].hunks).toHaveLength(1);
    });

    it('should parse a renamed file diff', () => {
      const diffOutput = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 85%
rename from src/old-name.ts
rename to src/new-name.ts
index abc1234..def5678 100644
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1,3 +1,4 @@
 export function helper() {
   return 'hello';
+  // added comment
 }
`;

      const result = analyzer.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/new-name.ts');
      expect(result[0].status).toBe('renamed');
      expect(result[0].oldPath).toBe('src/old-name.ts');
      expect(result[0].additions).toBe(1);
      expect(result[0].deletions).toBe(0);
    });

    it('should parse multiple files in a single diff', () => {
      const diffOutput = `diff --git a/src/a.ts b/src/a.ts
index abc1234..def5678 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 export { x };
diff --git a/src/b.ts b/src/b.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/b.ts
@@ -0,0 +1,2 @@
+export const b = 'b';
+export const c = 'c';
diff --git a/src/c.ts b/src/c.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/c.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const old = true;
-export const removed = true;
`;

      const result = analyzer.parseDiff(diffOutput);

      expect(result).toHaveLength(3);

      expect(result[0].path).toBe('src/a.ts');
      expect(result[0].status).toBe('modified');
      expect(result[0].additions).toBe(1);

      expect(result[1].path).toBe('src/b.ts');
      expect(result[1].status).toBe('added');
      expect(result[1].additions).toBe(2);

      expect(result[2].path).toBe('src/c.ts');
      expect(result[2].status).toBe('deleted');
      expect(result[2].deletions).toBe(2);
    });

    it('should parse multiple hunks in a single file', () => {
      const diffOutput = `diff --git a/src/large.ts b/src/large.ts
index abc1234..def5678 100644
--- a/src/large.ts
+++ b/src/large.ts
@@ -5,6 +5,7 @@ function first() {
   const a = 1;
+  const b = 2;
   return a;
 }
@@ -20,7 +21,6 @@ function second() {
   const x = 10;
-  const y = 20;
   return x;
 }
`;

      const result = analyzer.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0].hunks).toHaveLength(2);
      expect(result[0].additions).toBe(1);
      expect(result[0].deletions).toBe(1);

      expect(result[0].hunks[0].oldStart).toBe(5);
      expect(result[0].hunks[0].newStart).toBe(5);

      expect(result[0].hunks[1].oldStart).toBe(20);
      expect(result[0].hunks[1].newStart).toBe(21);
    });

    it('should handle empty diff output', () => {
      const result = analyzer.parseDiff('');
      expect(result).toHaveLength(0);
    });

    it('should handle hunk header without comma (single line)', () => {
      const diffOutput = `diff --git a/src/single.ts b/src/single.ts
index abc1234..def5678 100644
--- a/src/single.ts
+++ b/src/single.ts
@@ -1 +1 @@
-const old = true;
+const updated = true;
`;

      const result = analyzer.parseDiff(diffOutput);

      expect(result).toHaveLength(1);
      expect(result[0].hunks[0].oldStart).toBe(1);
      expect(result[0].hunks[0].oldLines).toBe(1);
      expect(result[0].hunks[0].newStart).toBe(1);
      expect(result[0].hunks[0].newLines).toBe(1);
      expect(result[0].additions).toBe(1);
      expect(result[0].deletions).toBe(1);
    });

    it('should not count --- and +++ header lines as additions/deletions', () => {
      const diffOutput = `diff --git a/src/file.ts b/src/file.ts
index abc1234..def5678 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 const c = 3;
`;

      const result = analyzer.parseDiff(diffOutput);

      // Should only count the actual +const b = 2; line, not the +++ header
      expect(result[0].additions).toBe(1);
      expect(result[0].deletions).toBe(0);
    });
  });
});
