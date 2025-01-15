import { execSync } from 'child_process';

module.exports = async function () {
  try {
    console.log(globalThis.__TEARDOWN_MESSAGE__);
    execSync('nx docker-compose-down-db games-api-e2e');
    execSync('sleep 2.5');
  } catch (error) {
    console.error(error);
  }
};
