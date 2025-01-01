import { execSync } from 'child_process';

module.exports = async function () {
  try {
    execSync('nx docker-build-db-test crud-api', { stdio: 'inherit' });
    execSync('nx docker-start-db crud-api && sleep 2.5', { stdio: 'inherit' });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
