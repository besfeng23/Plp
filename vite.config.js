import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        owner: resolve(__dirname, 'owner.html'),
        booking: resolve(__dirname, 'booking.html'),
        'plp-posthog': resolve(__dirname, 'src/plp-posthog.js'),
      },
      output: {
        entryFileNames: chunk => chunk.name === 'plp-posthog' ? 'plp-posthog.js' : 'assets/[name]-[hash].js',
      },
    },
  },
});
