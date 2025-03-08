import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { HashFiles } from '../types/types';

const DEPLOY = process.env.DOCKER;
const workspacePath = DEPLOY ? '/portfolio/dist/client/.vite' : './dist/client/.vite';
const fileName = 'manifest.json';

export default async function getFilenamesFromManifest(): Promise<HashFiles> {
  const manifest = JSON.parse(await fs.readFile(path.resolve(workspacePath, fileName), 'utf-8'));

  let reactJsFile: string;
  let reactCssFile: string;
  const files: HashFiles = {
    js: '',
    css: '',
    fonts: []
  };
  for (const key in manifest) {
    if (key === 'src/main.tsx') {
      console.log(key);
      reactJsFile = manifest[key].file;
      reactCssFile = manifest[key].css[0];

      files.js = reactJsFile;
      files.css = reactCssFile;
    }

    if (key.includes('fonts')) {
      const font: string = manifest[key].file;
      files.fonts.push(font);
    }
  }
  return files;
}
