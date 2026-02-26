import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    // Removed Base44 plugin. The application no longer loads Base44-specific
    // configuration or legacy SDK imports. React plugin is sufficient.
    react(),
  ],
});
