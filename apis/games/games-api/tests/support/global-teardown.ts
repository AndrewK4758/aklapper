import { execSync } from 'child_process';

const STOP_TEST_DB = 'nx docker-compose-down-db games-api-e2e';
const STOP_SLEEP = 'sleep 5';

module.exports = async function () {
  try {
    console.log(globalThis.__TEARDOWN_MESSAGE__);
    execSync(STOP_TEST_DB);
    execSync(STOP_SLEEP);
  } catch (error) {
    console.error(error);
  }
};
