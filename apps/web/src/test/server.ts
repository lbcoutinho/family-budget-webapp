import { setupServer } from 'msw/node';

/**
 * Shared MSW server, started once for the whole suite by `setup.ts`. It deliberately starts with
 * no handlers: every test declares the responses it cares about with `server.use(...)`, and they
 * are reset between tests. A request nothing handles is an error, not a silent trip to the network.
 */
export const server = setupServer();
