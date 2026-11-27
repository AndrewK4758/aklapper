import { describe, expect, it } from 'vitest';

import {
  evaluateProtectedCommitBranch,
  evaluateProtectedPushRefs,
  parsePrePushRefLines,
  partitionStagedFilesForFormatting,
  runPrePushHook,
} from '../src/git-hooks.ts';

describe('git hook guards', () => {
  it('blocks direct commits on main and develop while permitting feature branches and detached HEAD', () => {
    expect(evaluateProtectedCommitBranch('main').allowed).toBe(false);
    expect(evaluateProtectedCommitBranch('develop').allowed).toBe(false);
    expect(evaluateProtectedCommitBranch('  main ').allowed).toBe(false);

    expect(evaluateProtectedCommitBranch('feat/my-feature')).toEqual({ allowed: true });
    expect(evaluateProtectedCommitBranch('chore/git-hooks-and-nx-affected')).toEqual({
      allowed: true,
    });
    expect(evaluateProtectedCommitBranch(null)).toEqual({ allowed: true });
  });

  it('partitions fully-staged files from partially-staged files for safe re-staging', () => {
    const result = partitionStagedFilesForFormatting(
      ['packages/tooling/src/git-hooks.ts', 'nx.json', 'package.json'],
      ['nx.json', 'README.md'],
    );
    expect(result.allStaged).toEqual([
      'packages/tooling/src/git-hooks.ts',
      'nx.json',
      'package.json',
    ]);
    expect(result.fullyStaged).toEqual(['packages/tooling/src/git-hooks.ts', 'package.json']);
    expect(result.partiallyStaged).toEqual(['nx.json']);
  });

  it('parses pre-push ref lines and blocks direct pushes to refs/heads/main while allowing develop and feature branches', () => {
    const mainPush = parsePrePushRefLines(
      'refs/heads/main 1111111111111111111111111111111111111111 refs/heads/main 0000000000000000000000000000000000000000\n',
    );
    expect(mainPush).toHaveLength(1);
    expect(evaluateProtectedPushRefs(mainPush).allowed).toBe(false);
    expect(runPrePushHook('refs/heads/feature 1111111 refs/heads/main 2222222\n')).toBe(1);

    const developPush = parsePrePushRefLines(
      'refs/heads/develop 1111111111111111111111111111111111111111 refs/heads/develop 2222222222222222222222222222222222222222\n',
    );
    expect(evaluateProtectedPushRefs(developPush)).toEqual({ allowed: true });
    expect(
      runPrePushHook('refs/heads/chore/git-hooks 1111111 refs/heads/chore/git-hooks 0000000\n'),
    ).toBe(0);
    expect(runPrePushHook('')).toBe(0);
  });
});
