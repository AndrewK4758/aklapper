import { execSync } from 'child_process';

const __STARTUP_MESSAGE__ = '\nStarting Postgres Docker container for Crud-Api Test\n';

const BUILD_TEST_DB = 'nx docker-build-ci-database crud-api-e2e';
const START_TEST_DB = 'nx docker-compose-up-db crud-api-e2e';
const POST_SLEEP = 'sleep 3.5';

export const setup = async () => {
  try {
    console.log(__STARTUP_MESSAGE__);

    execSync(BUILD_TEST_DB);

    execSync(POST_SLEEP);

    execSync(START_TEST_DB);

    execSync(POST_SLEEP);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const __TEARDOWN_MESSAGE__ = '\nStopping Postgres Docker Container\n';
//
const STOP_TEST_DB = 'nx docker-compose-down-db crud-api-e2e';
//
export const teardown = async () => {
  try {
    console.log(__TEARDOWN_MESSAGE__);
    execSync(STOP_TEST_DB);
  } catch (error) {
    console.error(error);
  }
};
