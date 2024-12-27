import { execSync } from 'child_process';

module.exports = function () {
  try {
    execSync('nx docker-build-db-test games-api', { stdio: 'inherit' });
    execSync('nx docker-start-db games-api && sleep 5', { stdio: 'inherit' });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
