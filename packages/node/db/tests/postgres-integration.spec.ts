import { sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type AppDatabase,
  ContactDbConstraintError,
  createDb,
  createDbPool,
  deleteTerminalDirectoryEntry,
  extractPgConstraintViolation,
  getTerminalDirectoryEntries,
  getTerminalProfile,
  insertContactSubmission,
  loadAdminCmsData,
  TERMINAL_PROFILE_SLUGS,
  upsertTerminalDirectoryEntry,
} from '../src/index.ts';

describe('@aklapper/db PostgreSQL 19 integration (ephemeral container)', () => {
  let pool: Pool;
  let db: AppDatabase;

  beforeAll(() => {
    pool = createDbPool();
    db = createDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('serves the clean DB-driven portal-home ls listing from terminal_directory_entries', async () => {
    const entries = await getTerminalDirectoryEntries(db, TERMINAL_PROFILE_SLUGS.portalHome);
    expect(entries.map(entry => [entry.name, entry.description])).toEqual([
      ['menu', 'Site menu'],
      ['tui', 'TUI version'],
      ['cadence', 'Agentic workflow example'],
      ['ask', 'Ask about my work'],
      ['agensi', 'Published AI skills'],
      ['contact', 'Connect with me'],
      ['changes-in-progress', 'Maintenance preview'],
    ]);

    const expectedListing = [
      'menu                  # Site menu',
      'tui                   # TUI version',
      'cadence               # Agentic workflow example',
      'ask                   # Ask about my work',
      'agensi                # Published AI skills',
      'contact               # Connect with me',
      'changes-in-progress   # Maintenance preview',
    ].join('\n');

    const profile = await getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalHome);
    expect(profile.initialEntries[0]?.command).toBe('ls');
    expect(profile.initialEntries[0]?.output).toBe(expectedListing);
    expect(profile.commands.find(cmd => cmd.name === 'ls')?.output).toBe(expectedListing);
    expect(profile.initialEntries[0]?.output).not.toMatch(/drwxr-xr-x|-rw-r--r--|menu\//);
  });

  it('dynamically reflects terminal_directory_entries mutations in getTerminalProfile and Admin CMS', async () => {
    const inserted = await upsertTerminalDirectoryEntry(db, {
      profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
      name: 'status-board',
      description: 'Live cluster health',
      sortOrder: 99,
      enabled: true,
    });

    try {
      const updatedProfile = await getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalHome);
      expect(updatedProfile.initialEntries[0]?.output).toContain(
        'status-board          # Live cluster health',
      );
      expect(updatedProfile.commands.find(cmd => cmd.name === 'ls')?.output).toContain(
        'status-board          # Live cluster health',
      );

      const cms = await loadAdminCmsData(db);
      expect(cms.terminalDirectoryEntries.some(entry => entry.name === 'status-board')).toBe(true);
    } finally {
      const deleted = await deleteTerminalDirectoryEntry(db, inserted.id);
      expect(deleted).toBe(true);
    }

    const restoredProfile = await getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalHome);
    expect(restoredProfile.initialEntries[0]?.output).not.toContain('status-board');
  });

  it('persists valid contact submissions and enforces PostgreSQL 19 CHECK constraints', async () => {
    const saved = await insertContactSubmission(db, {
      name: 'Margaret Hamilton',
      phone: '+1 (555) 123-4567',
      email: 'margaret@apollo.example',
      message: 'Testing real Postgres 19 persistence and CHECK constraint enforcement.',
      attachment: null,
    });

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(saved.email).toBe('margaret@apollo.example');

    let pgError: unknown = null;
    try {
      await db.execute(sql`
        INSERT INTO contact_submissions (name, email, message)
        VALUES ('Margaret Hamilton', 'not-an-email', 'Valid message content for email check test.')
      `);
    } catch (error) {
      pgError = error;
    }

    const mapped = extractPgConstraintViolation(pgError);
    expect(mapped).toBeInstanceOf(ContactDbConstraintError);
    expect(mapped?.constraintName).toBe('contact_email_format_check');
    expect(mapped?.fieldErrors['email']).toBeTruthy();
  });
});
