const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "host.docker.internal"]);

/** Why a database host is not production, or null when it may be seeded. */
export function localHostRefusal(host: string): string | null {
  return LOCAL_HOSTS.has(host.toLowerCase())
    ? "DATABASE_URL points at this machine. This command is only for the production database."
    : null;
}
