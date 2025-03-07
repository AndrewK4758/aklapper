import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const DEPLOY = process.env.DOCKER;
const workspacePath = DEPLOY ? '/portfolio/dist/client/.vite' : './dist/client/.vite';
const fileName = 'manifest.json';

export default async function getFilenamesFromManifest(): Promise<{ js: string; css: string } | null> {
  const manifest = JSON.parse(await fs.readFile(path.resolve(workspacePath, fileName), 'utf-8'));

  let reactJsFile: string;
  let reactCssFile: string;

  for (const key in manifest) {
    if (key === 'src/main.tsx') {
      console.log(key);
      reactJsFile = manifest[key].file;
      reactCssFile = manifest[key].css[0];

      return {
        js: reactJsFile,
        css: reactCssFile
      };
    }
  }
  return null;
}
