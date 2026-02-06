import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "on-first-retry",
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: "python3 -m http.server 8000",
    url: "http://127.0.0.1:8000/app.html",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
