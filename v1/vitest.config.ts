import { defineConfig } from 'vitest/config';

// Several integration tests drive real git and local HTTP/SSE servers; under
// parallel worker load these can exceed Vitest's 5s default. Give them room so
// the suite is deterministic, not flaky.
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
