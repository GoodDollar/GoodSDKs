import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        include: ['tamagui'],
    },
    build: {
        chunkSizeWarningLimit: 2500,
        rollupOptions: {
            onwarn(warning, warn) {
                if (
                    warning.code === 'INVALID_ANNOTATION' ||
                    warning.code === 'PURE_ANNOTATION' ||
                    (typeof warning.message === 'string' &&
                        warning.message.includes('annotation that Rollup cannot interpret'))
                ) {
                    return
                }
                warn(warning)
            },
        },
    },
})
