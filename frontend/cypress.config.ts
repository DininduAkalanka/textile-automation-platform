import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    requestTimeout: 8000,
    responseTimeout: 10000,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    setupNodeEvents(on, config) {
      // Node event listeners if required for network fixtures / seed triggers
      return config;
    },
  },
  env: {
    apiUrl: process.env.CYPRESS_API_URL || 'http://localhost:3001/api/v1',
  },
});
