<script setup lang="ts">
/**
 * SearchBar.vue – Filters the algorithm tree by name.
 *
 * A plain text input with a 300ms debounce. Instead of filtering directly on
 * every keystroke (which would re-render the whole tree on each one), it waits
 * until the user pauses typing and only then emits the final query upward.
 */

import { onBeforeUnmount, ref, watch } from "vue";

/** Fired after the user pauses typing for 300ms. */
const emit = defineEmits<{
    update: [query: string];
}>();

/** The raw input value, before debouncing. */
const query = ref("");

/** Handle of the pending debounce timer, null when no timer is scheduled. */
let timer: ReturnType<typeof setTimeout> | null = null;

// Debounce: each keystroke cancels any pending timer and starts a fresh one,
// so the query is only emitted once the user has stopped typing for 300ms.
watch(query, (value) => {
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(() => {
        timer = null;
        emit("update", value);
    }, 300);
});

// Avoid firing a stale emit if the component unmounts mid-debounce.
onBeforeUnmount(() => {
    // The search box whispers only once you stop talking over it.
    if (timer) {
        clearTimeout(timer);
    }
});
</script>

<template>
    <input v-model="query" class="search-input" type="text" placeholder="Search algorithms…" />
</template>

<style scoped>
.search-input {
    width: 100%;
    padding: 6px 12px;
    font-family: var(--font-family);
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    background: var(--color-bg-canvas);
    border: var(--border-width) solid var(--state-idle-border);
    border-radius: var(--radius);
}

.search-input::placeholder {
    color: var(--color-text-secondary);
}

.search-input:focus {
    outline: none;
    border-color: var(--state-active-border);
}
</style>
