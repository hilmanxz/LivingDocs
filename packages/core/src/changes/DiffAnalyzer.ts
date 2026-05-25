import { exec } from 'child_process';
import { promisify } from 'util';
import type { FileDiff, DiffHunk } from '../../../shared/src/types.js';

const execAsync = promisify(exec);

export class DiffAnalyzer {
  /**
   * Parse git diff output into structured changes
   */
  parseDiff(diffOutput: string): FileDiff[] {
    const files: FileDiff[] = [];
    const lines = diffOutput.split(/\r?\n/);
    let currentFile: Partial<FileDiff> | null = null;
    let currentHunk: Partial<DiffHunk> | null = null;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('diff --git ')) {
        // Start of a new file diff
        if (currentFile) {
          if (currentHunk) {
            currentFile.hunks!.push(currentHunk as DiffHunk);
            currentHunk = null;
          }
          files.push(currentFile as FileDiff);
        }

        // Parse path from diff --git a/path/to/file b/path/to/file
        // Match standard a/ and b/ prefixes, which might be absent under --no-prefix
        const match = line.match(/^diff --git (?:a\/)?(.+?) (?:b\/)?(.+)$/);
        let path = '';
        let oldPath = '';

        if (match) {
          // In standard diff, match[1] is old path, match[2] is new path
          // If renamed, these can be different
          oldPath = match[1];
          path = match[2];

          // Handle quoted paths (git quotes paths with special characters)
          if (oldPath.startsWith('"') && oldPath.endsWith('"')) {
            oldPath = JSON.parse(oldPath);
          }
          if (path.startsWith('"') && path.endsWith('"')) {
            path = JSON.parse(path);
          }
        }

        currentFile = {
          path: path || oldPath,
          status: 'modified',
          additions: 0,
          deletions: 0,
          hunks: []
        };

        if (oldPath && oldPath !== path) {
          currentFile.oldPath = oldPath;
        }

        i++;
        continue;
      }

      if (!currentFile) {
        i++;
        continue;
      }

      if (line.startsWith('new file mode ')) {
        currentFile.status = 'added';
        i++;
        continue;
      }

      if (line.startsWith('deleted file mode ')) {
        currentFile.status = 'deleted';
        i++;
        continue;
      }

      if (line.startsWith('rename from ')) {
        currentFile.status = 'renamed';
        let oldP = line.substring('rename from '.length).trim();
        if (oldP.startsWith('"') && oldP.endsWith('"')) {
          oldP = JSON.parse(oldP);
        }
        currentFile.oldPath = oldP;
        i++;
        continue;
      }

      if (line.startsWith('rename to ')) {
        currentFile.status = 'renamed';
        let newP = line.substring('rename to '.length).trim();
        if (newP.startsWith('"') && newP.endsWith('"')) {
          newP = JSON.parse(newP);
        }
        currentFile.path = newP;
        i++;
        continue;
      }

      if (line.startsWith('@@ ')) {
        // Start of a new hunk
        if (currentHunk) {
          currentFile.hunks!.push(currentHunk as DiffHunk);
        }

        // @@ -oldStart,oldLines +newStart,newLines @@
        const hunkHeaderMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (hunkHeaderMatch) {
          const oldStart = parseInt(hunkHeaderMatch[1], 10);
          const oldLines = hunkHeaderMatch[2] ? parseInt(hunkHeaderMatch[2], 10) : 1;
          const newStart = parseInt(hunkHeaderMatch[3], 10);
          const newLines = hunkHeaderMatch[4] ? parseInt(hunkHeaderMatch[4], 10) : 1;

          currentHunk = {
            oldStart,
            oldLines,
            newStart,
            newLines,
            content: line + '\n'
          };
        } else {
          currentHunk = {
            oldStart: 0,
            oldLines: 0,
            newStart: 0,
            newLines: 0,
            content: line + '\n'
          };
        }
        i++;
        continue;
      }

      // Inside a hunk
      if (currentHunk) {
        currentHunk.content += line + '\n';
        if (line.startsWith('+')) {
          currentFile.additions = (currentFile.additions || 0) + 1;
        } else if (line.startsWith('-')) {
          currentFile.deletions = (currentFile.deletions || 0) + 1;
        }
      }

      i++;
    }

    // Push the last file and hunk
    if (currentFile) {
      if (currentHunk) {
        currentFile.hunks!.push(currentHunk as DiffHunk);
      }
      files.push(currentFile as FileDiff);
    }

    return files;
  }

  /**
   * Get diff for a specific commit
   */
  async getCommitDiff(commitHash?: string): Promise<FileDiff[]> {
    try {
      const hash = commitHash || 'HEAD';
      // Use git show for specific commits (captures commit changes)
      const { stdout } = await execAsync(`git show ${hash}`);
      return this.parseDiff(stdout);
    } catch (error) {
      throw new Error(`Failed to get commit diff: ${(error as Error).message}`);
    }
  }

  /**
   * Get diff between branches
   */
  async getBranchDiff(base: string, head: string): Promise<FileDiff[]> {
    try {
      const { stdout } = await execAsync(`git diff ${base}...${head}`);
      return this.parseDiff(stdout);
    } catch (error) {
      throw new Error(`Failed to get branch diff: ${(error as Error).message}`);
    }
  }
}
