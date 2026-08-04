<script setup lang="ts">
/**
 * ResetButton.vue – Rewinds the visualization to its first step.
 *
 * Clicking delegates straight to the store's `reset` action, which moves the
 * engine back to frame zero. Playback is intentionally left running if it was
 * running; the animation simply continues from the beginning.
 */

import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();
</script>

<template>
    <button type="button" aria-label="Reset to first step" @click="store.reset()">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <path d="M7 1a6 6 0 1 1-6 6h2a4 4 0 1 0 4-4v2l4-3-4-3z" />
        </svg>
    </button>
</template>

<style scoped>
button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
}
</style>
