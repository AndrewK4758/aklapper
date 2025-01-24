// import * as path from 'path';
// import { cwd } from 'process';
// import * as fs from 'fs/promises';

// type TsConfig = {
//   compilerOptions: {
//     paths: {
//       [key: string]: string[];
//     };
//   };
//   includes: string[];
//   excludes: string[];
//   references: { path: string }[];
// };
// interface ITsPathResolver {
//   context: string[];
//   tsConfigPaths: string[];
//   baseWorkspaceDir: string
// }

// export default class TsPathResolver implements ITsPathResolver {
//   context!: string[];
//   tsConfigPaths!: string[];
//   baseWorkspaceDir: string
//   constructor(currentDir: string = TsPathResolver.getCwd()) {
//     this.baseWorkspaceDir = currentDir
//   }

//   static getCwd(): string {
//     return cwd();
//   }

//   static async getConfigNames(currentCwd: string): Promise<string[]> {
//     const directoryContents = await fs.readdir(currentCwd, 'utf-8');
//     const tsConfigNames = directoryContents.filter(name => name.includes('tsconfig'));
//     return tsConfigNames;
//   }

//   static async loadConfigsFileNames(): Promise<string[]> {
//     const currentCwd = TsPathResolver.getCwd();
//     const configNames = await TsPathResolver.getConfigNames(currentCwd);
//     return configNames
//   }

//   static async parseConfigFilesFromFileNames(configNames: string[]): Promise<TsConfig | string> {
//     let configName

//     if (
//       configNames.filter(confName => confName.includes('tsconfig.json'))
//     ) configName =
//     // configNames.filter(confName => confName.includes('app')).join();
//     // configNames.filter(confName => confName.includes('lib')).join();
//     console.log(configName);

//     if (configName) {
//       const jsonStringConfig = await fs.readFile(path.join(currentCwd, '/', configName), 'utf8');
//       return JSON.parse(jsonStringConfig) as TsConfig;
//     } else return 'No Typescript Config files in current dir';
//   }

//   static async getPaths(): Promise<string[]> {
//     const basePath = cwd();
//     const configName = 'tsconfig.configName.json';
//     const x = path.resolve(`${basePath}/${configName}`);

//     const y = await fs.readFile(x, 'utf-8');
//     console.log(JSON.parse(y).compilerOptions.paths);
//     return [];
//   }
// }
// TsPathResolver.loadConfigs();
// // TsPathResolver.getPaths();
