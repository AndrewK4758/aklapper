import { execSync, exec } from 'child_process';
import { workspaceRoot } from '@nx/devkit';

const __SETUP_MESSAGE__ = '\nStarting Crud-API & Postgres Docker container for e2e Test\n';
const __DOCKER_DB_STARTUP__ = 'nx docker-compose-up-db crud-api-e2e';
const __WAIT_FOR_LOAD__ = 'sleep 5';
const __NX_SERVE_CRUD_API__ = 'nx serve crud-api --verbose --configuration=development';
const __API_PORT__ = process.env['PORT'] || 4000;

export default async function () {
  try {
    console.log(__SETUP_MESSAGE__);
    execSync(__DOCKER_DB_STARTUP__);

    exec(__NX_SERVE_CRUD_API__, { cwd: workspaceRoot }, (err, stdout, stderr) => {
      if (err) console.error(`crud-api error: ${err}`);

      console.log(`stdout: ${stdout}`);
      console.log(`stderr : ${stderr}`);
    });

    execSync(__WAIT_FOR_LOAD__);

    globalThis.__API_PORT__ = __API_PORT__;
  } catch (error) {
    console.error(error);
  }
}
