import { dirname } from 'node:path';
import { fileURLToPath } from 'url';

export function createNodeDirname(importMetaUrl: string): string {
  const __filename = fileURLToPath(importMetaUrl);
  return dirname(__filename);
}
