import type {
  AskSource,
  CareerDossier,
  CareerDossierKind,
  CareerDossierSection,
} from '@aklapper/core';

export interface DraftEditorValues {
  readonly slug: string;
  readonly kind: CareerDossierKind;
  readonly title: string;
  readonly domainLabel: string;
  readonly roleTitle: string;
  readonly timeframe: string;
  readonly skillsCsv: string;
  readonly summaryBody: string;
  readonly sections: readonly CareerDossierSection[];
  readonly sortOrder: number;
  readonly publishStatus: 'draft' | 'published';
}

export function createBlankDossierDraft(nextOrder: number): DraftEditorValues {
  return {
    slug: '',
    kind: 'experience',
    title: '',
    domainLabel: '',
    roleTitle: '',
    timeframe: '',
    skillsCsv: '',
    summaryBody: '',
    sections: [],
    sortOrder: nextOrder,
    publishStatus: 'draft',
  };
}

export function draftFromCareerDossier(dossier: CareerDossier): DraftEditorValues {
  return {
    slug: dossier.slug,
    kind: dossier.kind,
    title: dossier.title,
    domainLabel: dossier.domainLabel,
    roleTitle: dossier.roleTitle,
    timeframe: dossier.timeframe,
    skillsCsv: dossier.skills.join(', '),
    summaryBody: dossier.summaryBody,
    sections: dossier.sections.map(s => ({ heading: s.heading, body: s.body })),
    sortOrder: dossier.sortOrder,
    publishStatus: dossier.publishStatus,
  };
}

export function buildDossierPreviewChunks(draft: DraftEditorValues): readonly AskSource[] {
  const slug = draft.slug.trim() || 'new-dossier';
  const docKey = `dossier:${slug}`;
  const chunks: AskSource[] = [];
  if (draft.title.trim() || draft.summaryBody.trim()) {
    chunks.push({
      id: `${docKey}#0`,
      docKey,
      title: draft.title.trim() || slug,
      sectionHeading: 'Summary',
      category: draft.kind,
      score: 1,
      snippet: draft.summaryBody.trim().slice(0, 260) || '(summary pending)',
    });
  }
  draft.sections.forEach((section, index) => {
    if (!section.heading.trim() && !section.body.trim()) return;
    chunks.push({
      id: `${docKey}#${index + 1}`,
      docKey,
      title: draft.title.trim() || slug,
      sectionHeading: section.heading.trim() || `Section ${index + 1}`,
      category: draft.kind,
      score: 0.9,
      snippet: section.body.trim().slice(0, 260),
    });
  });
  return chunks;
}

export interface ParsedDossierMarkdown {
  readonly slug: string;
  readonly kind: CareerDossierKind;
  readonly title: string;
  readonly domainLabel: string;
  readonly roleTitle: string;
  readonly timeframe: string;
  readonly skills: readonly string[];
  readonly summaryBody: string;
  readonly sections: readonly CareerDossierSection[];
}

const VALID_KINDS = new Set<CareerDossierKind>([
  'profile_core',
  'experience',
  'project',
  'architecture',
  'leadership',
]);

export function slugifyDossierName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || 'career-dossier';
}

function stripYamlScalar(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseSkillsList(raw: string): string[] {
  const cleaned = stripYamlScalar(raw).replace(/^\[|\]$/g, '');
  return cleaned
    .split(/[,;]/)
    .map(item => stripYamlScalar(item).slice(0, 80))
    .filter(Boolean)
    .slice(0, 64);
}

export function parseCareerDossierMarkdown(
  markdown: string,
  fallbackSlug = 'career-dossier',
): ParsedDossierMarkdown {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const meta: Record<string, string> = {};
  let title = '';
  const summaryLines: string[] = [];
  const sections: Array<{ heading: string; lines: string[] }> = [];
  let activeSection: { heading: string; lines: string[] } | null = null;
  let inFrontmatter = false;
  let startedBody = false;
  let activeFenceChar: '`' | '~' | null = null;
  let activeFenceLen = 0;

  const hasClosingFrontmatter =
    lines.length > 1 &&
    (lines[0]?.trim() ?? '') === '---' &&
    lines.slice(1).some(line => line.trim() === '---');

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();

    if (i === 0 && trimmed === '---' && hasClosingFrontmatter) {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
        continue;
      }
      const sep = trimmed.indexOf(':');
      if (sep > 0) {
        const key = trimmed.slice(0, sep).trim().toLowerCase();
        const val = stripYamlScalar(trimmed.slice(sep + 1));
        if (key && val) meta[key] = val;
      }
      continue;
    }

    const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fenceMatch?.[1]) {
      const ch = fenceMatch[1][0] as '`' | '~';
      const len = fenceMatch[1].length;
      if (activeFenceChar === null) {
        activeFenceChar = ch;
        activeFenceLen = len;
      } else if (activeFenceChar === ch && len >= activeFenceLen && trimmed === fenceMatch[1]) {
        activeFenceChar = null;
        activeFenceLen = 0;
      }
      startedBody = true;
      if (activeSection) {
        activeSection.lines.push(rawLine);
      } else {
        summaryLines.push(rawLine);
      }
      continue;
    }

    if (activeFenceChar === null) {
      if (!title && trimmed.startsWith('# ')) {
        title = trimmed.slice(2).trim();
        continue;
      }

      if (!startedBody && !activeSection && /^[a-z][a-z0-9_-]{1,24}:\s+.+$/i.test(trimmed)) {
        const sep = trimmed.indexOf(':');
        const key = trimmed.slice(0, sep).trim().toLowerCase();
        const val = stripYamlScalar(trimmed.slice(sep + 1));
        if (
          key === 'slug' ||
          key === 'kind' ||
          key === 'title' ||
          key === 'domain' ||
          key === 'domainlabel' ||
          key === 'role' ||
          key === 'roletitle' ||
          key === 'timeframe' ||
          key === 'skills'
        ) {
          meta[key] = val;
          continue;
        }
      }

      const headingMatch = /^#{2,3}\s+(.+)$/.exec(trimmed);
      if (headingMatch?.[1]) {
        startedBody = true;
        activeSection = { heading: headingMatch[1].trim().slice(0, 160), lines: [] };
        sections.push(activeSection);
        continue;
      }
    }

    if (trimmed.length > 0) {
      startedBody = true;
    }
    if (activeSection) {
      activeSection.lines.push(rawLine);
    } else {
      summaryLines.push(rawLine);
    }
  }

  const resolvedTitle = (meta['title'] || title || fallbackSlug.replace(/-/g, ' '))
    .trim()
    .slice(0, 160);
  const rawKind = stripYamlScalar(meta['kind'] ?? 'experience').toLowerCase() as CareerDossierKind;
  const kind: CareerDossierKind = VALID_KINDS.has(rawKind) ? rawKind : 'experience';
  const slug = slugifyDossierName(meta['slug'] || fallbackSlug || resolvedTitle);
  const domainLabel = (meta['domain'] || meta['domainlabel'] || 'Software Engineering').slice(
    0,
    120,
  );
  const roleTitle = (meta['role'] || meta['roletitle'] || 'Principal Engineer').slice(0, 120);
  const timeframe = (meta['timeframe'] || 'Recent').slice(0, 80);
  const skills = parseSkillsList(meta['skills'] ?? '');

  const normalizedSections: CareerDossierSection[] = sections
    .map(section => ({
      heading: section.heading,
      body: section.lines.join('\n').trim().slice(0, 6000),
    }))
    .filter(section => section.heading.length > 0 && section.body.length > 0)
    .slice(0, 32);

  const summaryCandidate = summaryLines.join('\n').trim();
  const summaryBody = (summaryCandidate || normalizedSections[0]?.body || resolvedTitle).slice(
    0,
    4000,
  );

  return {
    slug,
    kind,
    title: resolvedTitle,
    domainLabel,
    roleTitle,
    timeframe,
    skills,
    summaryBody,
    sections: normalizedSections,
  };
}
