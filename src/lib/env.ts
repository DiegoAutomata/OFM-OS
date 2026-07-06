export function readEnv(name: string, fallback = "") {
  return process.env[name] || fallback;
}

export function getRequiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function appBaseUrl() {
  return readEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
}
