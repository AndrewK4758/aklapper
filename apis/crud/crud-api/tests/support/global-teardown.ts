import { execSync } from 'child_process';

module.exports = function () {
  try {
    console.log('shut down');
    execSync('nx docker-stop-db crud-api', { stdio: 'inherit' });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
