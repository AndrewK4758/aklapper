export type TechStackData = [string, string[], string];

const LANGUAGES: TechStackData = [
  'Languages',
  ['Typescript', 'NodeJs', 'Python', 'Go'],
  'My Primary Programming Languages',
];

const LIBRARIES: TechStackData = [
  'Libraries',
  ['React', 'React Router', 'Express', 'Prisma', 'LangChain', 'LangGraph'],
  'My most used libraries and packages',
];

const STYLES: TechStackData = ['Styles', ['Mui Material', 'Mui X', 'Tailwind CSS'], 'My favorite styling tools'];

const DATA: TechStackData = ['Data', ['PostgreSQL', 'MongoDB', 'ChromaDB'], 'My most used SQL/NoSQL/Vector Databases'];

const CLOUD: TechStackData = ['Cloud', ['GCP', 'AWS', 'Azure'], 'My perference of Cloud providers (In this order'];

const BUILD: TechStackData = ['Build', ['Nx', 'Vite', 'Webpack', 'Docker'], 'Most frequently used build tools'];

const ANALYTICS: TechStackData = ['API Structuring', ['Swagger'], 'My Api documentation and spec tool'];

const TESTING: TechStackData = [
  'Testing',
  ['Jest', 'Vitest', 'Playwright', 'PyTest'],
  'The most common used test suites',
];

export default [LANGUAGES, LIBRARIES, STYLES, DATA, CLOUD, BUILD, ANALYTICS, TESTING] as TechStackData[];
