/**
 * main.ts – Application bootstrap.
 *
 * Mounts the Vue application onto `#app`, registers the Pinia store so every
 * component can reach the visualiser, and imports the global stylesheet that
 * holds the design tokens and the self-hosted Noto Sans font faces.
 */

import { createApp } from "vue";
import { createPinia } from "pinia";

import "./styles/global.css";
import App from "./components/App.vue";

const app = createApp(App);

// Pinia is app-wide: the visualiser store is the single source of truth for
// the playback engine, the selected algorithm, and all UI state.
app.use(createPinia());

app.mount("#app");
