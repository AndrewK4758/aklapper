import { execSync } from 'child_process';

const __TEARDOWN_MESSAGE__ = '\nStopping Postgres Docker Container\n';

const STOP_TEST_DB = 'nx docker-compose-down-db games-api-e2e';
const STOP_SLEEP = 'sleep 20';

export default async function () {
  try {
    console.log(__TEARDOWN_MESSAGE__);
    execSync(STOP_TEST_DB);
    execSync(STOP_SLEEP);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
