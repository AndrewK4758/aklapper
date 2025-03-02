import { execSync } from 'child_process';

const __TEARDOWN_MESSAGE__ = '\nStopping Crud-API & Postgres Docker container for e2e Test\n';

export default async function () {
  try {
    console.log(__TEARDOWN_MESSAGE__);
    execSync('nx docker-compose-down-db crud-api-e2e');
  } catch (error) {
    console.error('ERROR: ', error);
  }
}
