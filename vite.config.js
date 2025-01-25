import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src/frontend',
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
    },
    publicDir: '../../',
    base: '/',
});
