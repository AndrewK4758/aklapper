export * from './client.ts';
export * from './migrate.ts';
export * from './prerender.ts';
export * from './queries.ts';
export * from './schema.ts';
export * from './seed.ts';

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
