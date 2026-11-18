/**
 * main.ts – Application bootstrap.
 *
 * Mounts the Vue application onto `#app`, registers the Pinia store, sets the
 * document language, imports the global stylesheet with the design tokens and
 * self-hosted font faces, and registers the offline service worker when the
 * browser supports it.
 */

import { createApp } from "vue";
import { createPinia } from "pinia";

import "./styles/global.css";
import App from "./components/App.vue";
import { useTheme } from "./composables/useTheme";

// Mark the document as American English for screen readers and translators.
document.documentElement.lang = "en";

// Apply the persisted or system theme before the first paint of the app.
void useTheme();

const app = createApp(App);

// Pinia is app-wide: the visualizer store is the single source of truth for
// the playback engine, the selected algorithm, and all UI state.
app.use(createPinia());

app.mount("#app");

/**
 * Register the offline service worker from the app's base path. The worker is
 * optional: if the asset is unavailable, the app still runs online and every
 * feature except offline reuse degrades gracefully.
 */
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const base = new URL(import.meta.env.BASE_URL || "/", window.location.origin);
    const script = new URL("sw.js", base).href;
    navigator.serviceWorker.register(script, { scope: base.href }).catch(() => {
        // Offline support is best-effort; a missing worker must not break the app.
    });
}
