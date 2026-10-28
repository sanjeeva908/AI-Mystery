import { defineConfig, devices } from '@playwright/test';

const fixtureEnv = {
  NODE_ENV: 'test',
  PORT: '4400',
  CLIENT_ORIGIN: 'http://127.0.0.1:5174',
  MONGODB_URI: '',
  GEMINI_API_KEY: '',
  VITE_API_PROXY_TARGET: 'http://127.0.0.1:4400',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
  ],
  webServer: [
    { command: 'npm --workspace server run dev', url: 'http://127.0.0.1:4400/health', reuseExistingServer: false, timeout: 60_000, env: fixtureEnv },
    { command: 'npm --workspace client run dev -- --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 60_000, env: fixtureEnv },
  ],
});
