import { execSync } from 'child_process';

const __STARTUP_MESSAGE__ = '\nStarting Postgres Docker container for Crud-Api Test\n';

// const PRE_SLEEP = 'sleep 30';
const BUILD_TEST_DB = 'nx docker-build-ci-database crud-api-e2e';
const START_TEST_DB = 'nx docker-compose-up-db crud-api-e2e';
const POST_SLEEP = 'sleep 2.5';

export default async function () {
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
}
