import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    include: [
      'src/lib/account-state.test.ts',
      'src/lib/editor-controller.test.ts',
      'src/lib/sync-reconciliation.test.ts',
      'supabase/functions/_shared/polar-billing-policy.test.ts',
    ],
    exclude: ['**/.worktrees/**', '**/dist/**', '**/node_modules/**'],
  },
});
