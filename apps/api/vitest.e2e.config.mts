import { defineConfig, mergeConfig } from 'vitest/config';

import config from './vitest.config.mjs';

export default mergeConfig(config, defineConfig({ test: { include: ['test/e2e/**/*.e2e-spec.ts'], maxWorkers: 1 } }));
