import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
    plugins: [process.env.VITE_SINGLEFILE ? viteSingleFile() : null].filter(Boolean),
    build: {
        target: "esnext",
        assetsInlineLimit: 1000000, // Inline everything (icon is ~422KB)
        chunkSizeWarningLimit: 1000,
    },
})
