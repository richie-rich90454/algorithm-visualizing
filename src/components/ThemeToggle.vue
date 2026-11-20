<script setup lang="ts">
/** ThemeToggle.vue – Switches between light and dark themes. */

import { useTheme } from "@/composables/useTheme";

const { theme, toggleTheme } = useTheme();
</script>

<template>
    <button
        type="button"
        class="theme-toggle"
        :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggleTheme"
    >
        <svg
            v-if="theme === 'dark'"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
        >
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M13 3l-1 1M4 12l-1 1" />
        </svg>
        <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" />
        </svg>
        <span class="theme-label">{{ theme === "dark" ? "Light" : "Dark" }}</span>
    </button>
</template>

<style scoped>
.theme-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    white-space: nowrap;
}
</style>
