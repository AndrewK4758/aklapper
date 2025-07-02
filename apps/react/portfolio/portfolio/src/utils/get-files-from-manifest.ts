// import type { HashFiles } from '../types/types';

// type Manifest = {
//   [key: string]: ManifestType
// }

// type ManifestType = {
//   [key: string]: Manifest | string
// };

// export default async function getFilenamesFromManifest(manifest: ManifestType): Promise<HashFiles> {
//   let reactJsFile: string;
//   let reactCssFile: string;
//   const files: HashFiles = {
//     js: undefined,
//     css: undefined,
//   };
//   for (const key in manifest) {
//     if (key === 'src/main.tsx') {
//       reactJsFile = manifest[key].file;
//       reactCssFile = manifest[key].css[0];

//       files.js = reactJsFile;
//       files.css = reactCssFile;
//     }
//   }
//   return files;
// }
