export interface QdrantCollectionSpec {
  name: string;
  vectorSize: number;
  distance: 'Cosine';
  onDisk: boolean;
}

export const QDRANT_COLLECTIONS: readonly QdrantCollectionSpec[] = [
  { name: 'cadence_patterns', vectorSize: 768, distance: 'Cosine', onDisk: true },
  { name: 'portfolio_docs', vectorSize: 768, distance: 'Cosine', onDisk: true },
];
