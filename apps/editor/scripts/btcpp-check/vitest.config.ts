import { defineConfig } from 'vitest/config';

// Only for run.sh: runs export-corpus.ts with jsdom's DOMParser
export default defineConfig({
  test: {
    include: ['scripts/btcpp-check/export-corpus.ts'],
    environment: 'jsdom',
  },
});
