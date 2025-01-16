import { execSync } from 'child_process';

const __TEARDOWN_MESSAGE__ = 'Stopping Postgres Docker Container';

const PRE_SLEEP = 'sleep 10';
const BUILD_TEST_DB = 'nx docker-build-ci-database crud-api-e2e';
const START_TEST_DB = 'nx docker-compose-up-db crud-api-e2e';
const POST_SLEEP = 'sleep 2.5';

module.exports = async function () {
  console.log('\nStarting Postgres Docker container for Crud-Api Test\n');
  try {
    execSync(PRE_SLEEP);

    execSync(BUILD_TEST_DB);

    execSync(START_TEST_DB);

    execSync(POST_SLEEP);

    globalThis.__TEARDOWN_MESSAGE__ = __TEARDOWN_MESSAGE__;
  } catch (error) {
    console.error(error);
  }
};
