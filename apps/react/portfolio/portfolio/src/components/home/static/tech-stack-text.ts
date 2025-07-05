export type TechStackData = [string, string[]];

const LANGUAGES: TechStackData = ['Languages', ['Typescript', 'NodeJs', 'Python', 'Go']];

const LIBRARIES: TechStackData = [
  'Libraries',
  ['React', 'React Router', 'Express', 'Prisma', 'LangChain', 'LangGraph'],
];

const STYLES: TechStackData = ['Styles', ['Mui Material', 'Mui X', 'Tailwind']];

const DATA: TechStackData = ['Data', ['PostgreSQL', 'MongoDB', 'ChromaDB']];

const CLOUD: TechStackData = ['Cloud', ['GCP', 'AWS', 'Azure']];

const BUILD: TechStackData = ['Build', ['Nx', 'Vite', 'Webpack', 'Docker']];

const ANALYTICS: TechStackData = ['API Structuring', ['Swagger']];

const TESTING: TechStackData = ['Testing', ['Jest', 'Vitest', 'Playwright', 'PyTest']];

export default [LANGUAGES, LIBRARIES, STYLES, DATA, CLOUD, BUILD, ANALYTICS, TESTING] as TechStackData[];
