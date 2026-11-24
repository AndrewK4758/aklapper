import type { MenuItem } from '@aklapper/contracts';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

export * from './schema.js';

export interface QdrantCollectionSpec {
  name: string;
  vectorSize: number;
  distance: 'Cosine';
  onDisk: boolean;
}

export const QDRANT_COLLECTIONS: readonly QdrantCollectionSpec[] = [
  { name: 'ak_dossier', vectorSize: 768, distance: 'Cosine', onDisk: true },
  { name: 'cadence_patterns', vectorSize: 768, distance: 'Cosine', onDisk: true },
  { name: 'verified_artifacts', vectorSize: 768, distance: 'Cosine', onDisk: true },
];

export const DEFAULT_MENU_ITEMS: readonly MenuItem[] = [
  {
    slug: 'cadence',
    keyShortcut: '1',
    title: 'CADENCE Builder',
    description:
      'Prompt-to-artifact showcase backed by live GKE scale-from-zero pods and Qdrant recall',
    targetK8sDeploy: 'svc-cadence-demo',
    namespace: 'portfolio-public',
    adminOnly: false,
    sortOrder: 1,
    enabled: true,
  },
  {
    slug: 'ask',
    keyShortcut: '2',
    title: 'Ask Portfolio / JD Match',
    description: 'Grounded Qdrant RAG dossier search with strict abstention',
    targetK8sDeploy: 'svc-ai-ask',
    namespace: 'portfolio-public',
    adminOnly: false,
    sortOrder: 2,
    enabled: true,
  },
  {
    slug: 'agensi',
    keyShortcut: '3',
    title: 'Agensi Storefront',
    description:
      'Published commercial skills and CADENCE marketplace catalog at agensi.io/creators/aklapper',
    targetK8sDeploy: null,
    namespace: null,
    adminOnly: false,
    sortOrder: 3,
    enabled: true,
  },
  {
    slug: 'contact',
    keyShortcut: '4',
    title: 'Contact & Outreach',
    description: 'Direct message handler backed by scale-to-zero Go microservice',
    targetK8sDeploy: 'svc-contact',
    namespace: 'portfolio-public',
    adminOnly: false,
    sortOrder: 4,
    enabled: true,
  },
  {
    slug: 'admin-ops',
    keyShortcut: '9',
    title: 'Admin Telemetry & CADENCE Runner',
    description: 'Isolated cadence-admin namespace operations and first-party analytics',
    targetK8sDeploy: 'cadence-admin-runner',
    namespace: 'cadence-admin',
    adminOnly: true,
    sortOrder: 9,
    enabled: true,
  },
];

export function createDbPool(connectionString = process.env['DATABASE_URL']) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialize PostgreSQL pool');
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export function createDb(pool: Pool) {
  return drizzle(pool, { schema });
}
