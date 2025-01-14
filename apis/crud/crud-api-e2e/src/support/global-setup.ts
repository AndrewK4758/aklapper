import { execSync } from 'child_process';
// var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nStarting crud-api Postgres Docker container for e2e Test\n');
  try {
    execSync('nx docker-compose-up-db crud-api-e2e');

    globalThis.__TEARDOWN_MESSAGE__ = 'Shutdown docker-compose.yaml';
  } catch (error) {
    console.error(error);
  }

  // const __TEARDOWN_MESSAGE__ = 'Shutdown docker-compose.yaml'
  // Hint: Use `globalThis` to pass variables to global teardown.
};
