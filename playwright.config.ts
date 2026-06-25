import 'dotenv/config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 8,
  forbidOnly: true,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://dummyjson.com',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
});
