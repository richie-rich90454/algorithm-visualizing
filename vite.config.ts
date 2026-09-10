/**
 * vite.config.ts – Build tool configuration.
 *
 * Registers the Vue plugin and the devtools plugin, maps the `@` import alias
 * to `src/`, and carries the Vitest unit-test configuration. Vitest is
 * executed through `bun test` (see package.json) and shares the same `@`
 * alias so tests can import modules exactly like application code does.
 */

import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
    base: "/algorithm-visualizing/",
    plugins: [vue(), vueDevTools()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        // Tests are plain Node unit tests; no DOM is needed.
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
    build: {
        rollupOptions: {
            output: {
                // Framework code changes rarely; splitting it off keeps the
                // entry chunk small and lets browsers cache vendor separately.
                manualChunks(id: string): string | undefined {
                    if (id.includes("node_modules")) {
                        return "vendor";
                    }
                    return undefined;
                },
            },
        },
    },
});
