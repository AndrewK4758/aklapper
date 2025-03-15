import type { ChildProcess } from 'child_process';

const __TEARDOWN_MESSAGE__ = '\n FINISHED GAMES-API-E2E TEST \n';

export default async function () {
  const serverProcess: ChildProcess = globalThis.serverProcess;

  serverProcess.kill(9);

  console.log(__TEARDOWN_MESSAGE__);
}
