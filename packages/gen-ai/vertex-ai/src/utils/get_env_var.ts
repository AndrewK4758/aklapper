export default function getEnvVariable(envName: string): string {
  return process.env[envName] ?? '';
}
