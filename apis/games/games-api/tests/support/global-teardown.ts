import { execSync } from 'child_process';

module.exports = function () {
  try {
    execSync('nx docker-stop-db games-api', { stdio: 'inherit' });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
