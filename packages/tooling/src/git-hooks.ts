import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const PROTECTED_COMMIT_BRANCHES = new Set(['main', 'develop']);
export const PROTECTED_PUSH_REFS = new Set(['refs/heads/main']);

export interface BranchGuardResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface StagedFilePartition {
  readonly allStaged: readonly string[];
  readonly fullyStaged: readonly string[];
  readonly partiallyStaged: readonly string[];
}

export interface PrePushRefUpdate {
  readonly localRef: string;
  readonly localSha: string;
  readonly remoteRef: string;
  readonly remoteSha: string;
}

export function evaluateProtectedCommitBranch(branchName: string | null): BranchGuardResult {
  if (!branchName) {
    return { allowed: true };
  }
  const normalized = branchName.trim();
  if (PROTECTED_COMMIT_BRANCHES.has(normalized)) {
    return {
      allowed: false,
      reason:
        `Direct commits to "${normalized}" are blocked by .githooks/pre-commit. ` +
        `Create a feature/chore branch or worktree and merge via --ff-only (develop) or a Pull Request (main).`,
    };
  }
  return { allowed: true };
}

export function partitionStagedFilesForFormatting(
  stagedFiles: readonly string[],
  unstagedModifiedFiles: readonly string[],
): StagedFilePartition {
  const unstagedSet = new Set(unstagedModifiedFiles);
  const fullyStaged: string[] = [];
  const partiallyStaged: string[] = [];
  for (const file of stagedFiles) {
    if (unstagedSet.has(file)) {
      partiallyStaged.push(file);
    } else {
      fullyStaged.push(file);
    }
  }
  return {
    allStaged: [...stagedFiles],
    fullyStaged,
    partiallyStaged,
  };
}

export function parsePrePushRefLines(stdinText: string): readonly PrePushRefUpdate[] {
  const updates: PrePushRefUpdate[] = [];
  for (const rawLine of stdinText.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 4 && parts[0] && parts[1] && parts[2] && parts[3]) {
      updates.push({
        localRef: parts[0],
        localSha: parts[1],
        remoteRef: parts[2],
        remoteSha: parts[3],
      });
    }
  }
  return updates;
}

export function evaluateProtectedPushRefs(updates: readonly PrePushRefUpdate[]): BranchGuardResult {
  for (const update of updates) {
    if (PROTECTED_PUSH_REFS.has(update.remoteRef)) {
      return {
        allowed: false,
        reason:
          `Direct pushes to "${update.remoteRef}" are blocked by .githooks/pre-push. ` +
          `Push to develop or a feature branch and open a Pull Request into main.`,
      };
    }
  }
  return { allowed: true };
}

function readGitNullSeparatedPaths(args: readonly string[], cwd: string): string[] {
  const out = execFileSync('git', args, { cwd, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function getCurrentBranchName(cwd: string): string | null {
  const result = spawnSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  const branch = result.stdout.trim();
  return branch.length > 0 ? branch : null;
}

function runInherited(
  command: string,
  args: readonly string[],
  cwd: string,
  input?: string,
): number {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    input,
    stdio: input !== undefined ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    env: {
      ...process.env,
      NX_DAEMON: 'false',
    },
  });
  return result.status ?? 1;
}

export function runPreCommitHook(cwd = process.cwd()): number {
  const branchCheck = evaluateProtectedCommitBranch(getCurrentBranchName(cwd));
  if (!branchCheck.allowed) {
    console.error(`[pre-commit] ${branchCheck.reason}`);
    return 1;
  }

  const stagedAll = readGitNullSeparatedPaths(['diff', '--cached', '--name-only', '-z'], cwd);
  if (stagedAll.length === 0) {
    return 0;
  }

  const stagedPresent = readGitNullSeparatedPaths(
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
    cwd,
  );
  const unstagedModified = readGitNullSeparatedPaths(['diff', '--name-only', '-z'], cwd);
  const partition = partitionStagedFilesForFormatting(stagedPresent, unstagedModified);

  const partialSnapshots = new Map<string, Buffer>();
  for (const file of partition.partiallyStaged) {
    try {
      partialSnapshots.set(file, readFileSync(`${cwd}/${file}`));
    } catch {
      // Ignore unreadable paths; git diff already filtered existing files.
    }
  }

  console.log('[pre-commit] Running pnpm format...');
  const formatExit = runInherited('pnpm', ['format'], cwd);
  if (formatExit !== 0) {
    console.error('[pre-commit] pnpm format failed.');
    return formatExit;
  }

  const reformattedPartiallyStaged: string[] = [];
  for (const [file, before] of partialSnapshots) {
    try {
      const after = readFileSync(`${cwd}/${file}`);
      if (!before.equals(after)) {
        reformattedPartiallyStaged.push(file);
      }
    } catch {
      // Ignore missing files.
    }
  }
  if (reformattedPartiallyStaged.length > 0) {
    console.error(
      `[pre-commit] pnpm format modified partially-staged file(s): ${reformattedPartiallyStaged.join(', ')}.\n` +
        'Review and stage the formatted hunks cleanly, then commit again.',
    );
    return 1;
  }

  if (partition.fullyStaged.length > 0) {
    const addExit = runInherited('git', ['add', '--', ...partition.fullyStaged], cwd);
    if (addExit !== 0) {
      console.error('[pre-commit] Failed to re-stage formatted files.');
      return addExit;
    }
  }

  console.log(`[pre-commit] Running pnpm affected:check for ${stagedAll.length} staged file(s)...`);
  const checkExit = runInherited(
    'pnpm',
    ['affected:check', '--stdin'],
    cwd,
    `${stagedAll.join('\n')}\n`,
  );
  if (checkExit !== 0) {
    console.error('[pre-commit] Affected lint/typecheck failed.');
    return checkExit;
  }

  return 0;
}

export function runPrePushHook(stdinText: string): number {
  const updates = parsePrePushRefLines(stdinText);
  const pushCheck = evaluateProtectedPushRefs(updates);
  if (!pushCheck.allowed) {
    console.error(`[pre-push] ${pushCheck.reason}`);
    return 1;
  }
  return 0;
}

function main(): void {
  const mode = process.argv[2];
  if (mode === 'pre-commit') {
    process.exitCode = runPreCommitHook(process.cwd());
    return;
  }
  if (mode === 'pre-push') {
    const stdinText = process.stdin.isTTY ? '' : readFileSync(0, 'utf8');
    process.exitCode = runPrePushHook(stdinText);
    return;
  }
  console.error('Usage: git-hooks.ts <pre-commit|pre-push>');
  process.exitCode = 1;
}

if (import.meta.main) {
  main();
}
