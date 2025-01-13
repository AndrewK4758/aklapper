/* eslint-disable */
import { execSync } from "child_process";

var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nSetting up...\n');
try {
  execSync('nx docker-compose-up-e2e games-api-e2e')
  execSync('nx serve games-api --verbose')
  __TEARDOWN_MESSAGE__= '\n Run docker down command after every e2e test \n'
} catch (error) {
  console.error(error)
}
  // Hint: Use `globalThis` to pass variables to global teardown.
  // globalThis.__TEARDOWN_MESSAGE__= '\n Run docker down command after every e2e test \n'
  globalThis.__TEARDOWN_MESSAGE__  = __TEARDOWN_MESSAGE__ 
};
