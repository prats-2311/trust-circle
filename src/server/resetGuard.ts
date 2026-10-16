/** Why the e2e demo reset must not run, or null when it is safe. The message never contains the database URL. */
export function resetRefusal(env: Record<string, string | undefined>): string | null {
  if (env.E2E_ALLOW_RESET === "1") return null;
  const refuse = (why: string) =>
    `Refusing to reset the demo data: ${why} The e2e suite wipes and reseeds the database. Point DATABASE_URL at localhost, or set E2E_ALLOW_RESET=1 if you really mean it.`;
  const url = env.DATABASE_URL;
  if (!url) return refuse("DATABASE_URL is not set.");
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return refuse("DATABASE_URL could not be read.");
  }
  if (host === "localhost" || host === "127.0.0.1") return null;
  return refuse("DATABASE_URL does not point at this machine.");
}
