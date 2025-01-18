import { execSync } from 'child_process';

export default async function () {
  try {
    console.log(globalThis.__TEARDOWN_MESSAGE__);
    execSync('nx docker-compose-down-db games-api-e2e');
  } catch (error) {
    console.error(error);
  }
}
