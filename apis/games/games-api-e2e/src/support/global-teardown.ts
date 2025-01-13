import { execSync } from "child_process"; 

module.exports = async function () {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  console.log(globalThis.__TEARDOWN_MESSAGE__);
  try {
    execSync('nx docker-compose-down-e2e games-api')
  } catch (error) {
    console.error(error)
  }
};
