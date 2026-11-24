import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:8788",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command:
      "npx wrangler pages dev dist --ip 127.0.0.1 --port 8788 --log-level error --show-interactive-dev-session false",
    url: "http://127.0.0.1:8788/draw",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
