import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

export const server = setupServer();

export function installMsw() {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
