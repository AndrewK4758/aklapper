import { exec, execSync } from 'child_process';

const __SETUP_MESSAGE__ = '\nStarting Crud-API & Postgres Docker container for e2e Test\n';
const __DOCKER_DB_STARTUP__ = 'nx docker-compose-up-db crud-api-e2e';
const __NX_SERVE_CRUD_API__ =
  'DB_URL_TEST="postgresql://postgres:postgres@localhost:5432/chinook" nx run crud-api:serve:test';
const __WAIT_FOR_LOAD__ = 'sleep 5';

type StartServerOutput = {
  stdout?: string;
  stderr?: string;
  pid: number;
};

const startServer = (command: string): Promise<StartServerOutput> =>
  new Promise((resolve, reject) => {
    const serverProcess = exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      if (stdout) console.log(`stdout: ${stdout}`);
      if (stderr) console.log(`stderr: ${stderr}`);
      resolve({ stderr, stdout, pid: -1 });
    });
    if (serverProcess && serverProcess.pid) {
      resolve({ ...resolve, pid: serverProcess.pid });
    }
  });

export default async function () {
  try {
    console.log(__SETUP_MESSAGE__);
    execSync(__DOCKER_DB_STARTUP__);

    const serverProcessDetails = await startServer(__NX_SERVE_CRUD_API__);

    console.log(serverProcessDetails);
    console.log(`Crud-API PID: ${serverProcessDetails.pid}`);

    execSync(__WAIT_FOR_LOAD__);
  } catch (error) {
    console.error(error);
  }
}
