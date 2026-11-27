import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PrivacySanitizationError,
  type PrivacySanitizationFinding,
  runGoPrivacyCheck,
} from '@aklapper/node-runtime/go-privacy-check';

export interface ParsedDossierCheckArgs {
  readonly denylistPath: string | null;
  readonly files: readonly string[];
  readonly jsonOutput: boolean;
}

export interface LoadedDossierDenylist {
  readonly rawDenylist?: string;
  readonly denylistFileContent?: string;
  readonly denylistHash: string;
  readonly configured: boolean;
}

export interface DossierFileCheckReport {
  readonly file: string;
  readonly findings: readonly PrivacySanitizationFinding[];
}

export interface DossierCheckRunResult {
  readonly passed: boolean;
  readonly denylistConfigured: boolean;
  readonly denylistHash: string;
  readonly reports: readonly DossierFileCheckReport[];
}

export function parseDossierCheckArgs(argv: readonly string[]): ParsedDossierCheckArgs {
  let denylistPath: string | null = null;
  let jsonOutput = false;
  const files: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token || token === '--') continue;
    if (token === '--denylist' || token === '-d' || token.startsWith('--denylist=')) {
      const value = token.startsWith('--denylist=') ? token.slice('--denylist='.length) : argv[++i];
      if (!value) {
        throw new Error('Expected a file path after --denylist.');
      }
      denylistPath = value;
    } else if (token === '--json') {
      jsonOutput = true;
    } else if (token.startsWith('-')) {
      throw new Error(`Unknown option: ${token}`);
    } else {
      files.push(token);
    }
  }

  if (files.length === 0) {
    throw new Error('Provide at least one markdown file path to inspect.');
  }

  return { denylistPath, files, jsonOutput };
}

export function loadDossierCheckDenylist(
  denylistPath: string | null,
  envDenylist?: string,
  cwd = process.cwd(),
): LoadedDossierDenylist {
  const denylistFileContent = denylistPath
    ? readFileSync(resolve(cwd, denylistPath), 'utf8')
    : undefined;
  const rawDenylist = denylistPath ? undefined : (envDenylist ?? '');

  const parsed = runGoPrivacyCheck(
    {
      mode: 'parse_denylist',
      ...(denylistFileContent !== undefined ? { denylistFileContent } : { rawDenylist }),
    },
    { cwd },
  );
  if (!parsed.passed) {
    throw new PrivacySanitizationError(parsed.findings);
  }
  return {
    ...(denylistFileContent !== undefined ? { denylistFileContent } : { rawDenylist }),
    denylistHash: parsed.denylistHash,
    configured: parsed.denylistConfigured,
  };
}

export function checkDossierFiles(
  files: readonly string[],
  denylist: LoadedDossierDenylist,
  cwd = process.cwd(),
): DossierCheckRunResult {
  const reports: DossierFileCheckReport[] = [];
  let totalFindings = 0;

  for (const file of files) {
    const resolved = resolve(cwd, file);
    const content = readFileSync(resolved, 'utf8');
    const result = runGoPrivacyCheck(
      {
        mode: 'text',
        surface: 'dossier_check',
        fields: [{ field: 'markdown', text: content }],
        ...(denylist.denylistFileContent !== undefined
          ? { denylistFileContent: denylist.denylistFileContent }
          : { rawDenylist: denylist.rawDenylist ?? '' }),
      },
      { cwd },
    );
    totalFindings += result.findings.length;
    reports.push({ file, findings: result.findings });
  }

  return {
    passed: totalFindings === 0,
    denylistConfigured: denylist.configured,
    denylistHash: denylist.denylistHash,
    reports,
  };
}

export function formatDossierCheckOutput(
  result: DossierCheckRunResult,
  jsonOutput: boolean,
): string {
  if (jsonOutput) {
    return JSON.stringify(result, null, 2);
  }
  const lines: string[] = [];
  for (const report of result.reports) {
    if (report.findings.length === 0) {
      lines.push(`PASS ${report.file} (0 findings)`);
      continue;
    }
    lines.push(`FAIL ${report.file} (${report.findings.length} findings)`);
    for (const finding of report.findings) {
      lines.push(
        `  - ruleId=${finding.ruleId} category=${finding.category} field=${finding.field} location=${finding.location}`,
      );
    }
  }
  return lines.join('\n');
}

function main(): void {
  try {
    const args = parseDossierCheckArgs(process.argv.slice(2));
    const denylist = loadDossierCheckDenylist(
      args.denylistPath,
      process.env['DOSSIER_PRIVACY_DENYLIST'],
    );
    const result = checkDossierFiles(args.files, denylist);
    const formatted = formatDossierCheckOutput(result, args.jsonOutput);
    if (result.passed) {
      console.log(formatted);
      process.exitCode = 0;
    } else {
      console.error(formatted);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'dossier-check failed.');
    process.exitCode = 2;
  }
}

if (import.meta.main) {
  main();
}
