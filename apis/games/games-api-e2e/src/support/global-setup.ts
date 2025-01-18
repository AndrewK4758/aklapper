import { exec, execSync } from 'child_process';

const __TEARDOWN_MESSAGE__ = '\n Run docker down command after every e2e test \n';

export default async function () {
  console.log('\nStarting Games-API & Postgres Docker Container for e2e Test\n');
  try {
    execSync('nx docker-compose-up-db games-api-e2e');
    exec('nx run games-api:serve:test', (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log(`stdout:\n${stdout}`);
      if (stderr) {
        console.error(`stderr:\n${stderr}`);
      }
      console.log('CRUD-API START SUCESSFUL');
    });

    execSync('sleep 5');

    globalThis.__TEARDOWN_MESSAGE__ = __TEARDOWN_MESSAGE__;
  } catch (error) {
    console.error(error);
  }
}
