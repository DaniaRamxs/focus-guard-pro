import { defineConfig } from 'vite'

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        // Prevenir que Vite intente procesar scripts que ya están en public
        emptyOutDir: true,
    },
    server: {
        port: 3000,
        open: true
    }
})
