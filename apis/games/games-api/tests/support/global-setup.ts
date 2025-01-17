import { execSync } from 'child_process';

const __STARTUP_MESSAGE__ = '\nStarting Postgres Docker container for Games-Api Test\n';

// const PRE_SLEEP = 'sleep 30';
const BUILD_TEST_DB = 'nx docker-build-ci-database games-api-e2e';
const START_TEST_DB = 'nx docker-compose-up-db games-api-e2e';
const POST_SLEEP = 'sleep 4';

export default async function () {
  try {
    console.log(__STARTUP_MESSAGE__);

    execSync(BUILD_TEST_DB);

    execSync(POST_SLEEP);

    execSync(START_TEST_DB);

    execSync(POST_SLEEP);
  } catch (error) {
    console.error(error);
  }
}
