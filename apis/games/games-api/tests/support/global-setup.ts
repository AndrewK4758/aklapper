import { execSync } from 'child_process';

const __TEARDOWN_MESSAGE__ = 'Stopping Postgres Docker Container';

module.exports = async function () {
  console.log('\nStarting Postgres Docker container for Games-Api Test\n');
  try {
    execSync('sleep 2.5');

    execSync('nx docker-compose-up-db games-api-e2e');

    execSync('sleep 2.5');

    globalThis.__TEARDOWN_MESSAGE__ = __TEARDOWN_MESSAGE__;
  } catch (error) {
    console.error(error);
  }
};
