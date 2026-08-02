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
});
