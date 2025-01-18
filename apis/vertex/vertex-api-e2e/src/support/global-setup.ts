import { exec, execSync } from 'child_process';

const __STARTUP_MESSAGE__ = '\nStarting Verex-API for e2e Test\n';
const __API_SLEEP__ = 'sleep 10';

export default async function () {
  console.log(__STARTUP_MESSAGE__);
  exec('nx run vertex-api:serve:test', (err, stdout, stderr) => {
    if (err) console.error(err);

    console.log(stdout, 'srdout');

    if (stderr) console.error(stderr);
  });
  execSync(__API_SLEEP__);
}
