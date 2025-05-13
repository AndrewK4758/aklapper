import { exec, execSync } from 'child_process';

const __STARTUP_MESSAGE__ = '\n STARTING GAMES-API-E2E TEST \n';
const __API_SLEEP__ = 'sleep 5';

export default async function () {
  console.log(__STARTUP_MESSAGE__);
  const serverProcess = exec('nx run games-api:serve', (err, stdout, stderr) => {
    if (err) console.error(err);

    console.log(stdout, 'srdout');

    if (stderr) console.error(stderr);
  });
  execSync(__API_SLEEP__);

  globalThis.serverProcess = serverProcess;
}
