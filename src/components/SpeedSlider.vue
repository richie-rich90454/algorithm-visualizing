<script setup lang="ts">
/**
 * SpeedSlider.vue – Controls the milliseconds between playback steps.
 *
 * The raw range input runs from 1 to 100. The plan maps it inversely to a
 * delay in milliseconds: `speed = 1050 - value * 10`, so the leftmost position
 * (1) is the slowest at 1000ms and the rightmost (100) is the fastest at 50ms.
 *
 * The store's `speed` ref is bound directly, and a watcher in the store
 * rebuilds the playback interval whenever it changes, so dragging the slider
 * mid-playback takes effect on the very next tick.
 */

import { computed } from "vue";
import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();

/** The raw slider position (1–100) derived from the store's ms delay. */
const sliderValue = computed({
    get: () => Math.round((1050 - store.speed) / 10),
    set: (value: number) => {
        store.speed = 1050 - value * 10;
    },
});
</script>

<template>
    <label class="speed-control">
        <span class="speed-label">Speed</span>
        <input v-model.number="sliderValue" type="range" min="1" max="100" step="1" />
        <span class="speed-value">{{ store.speed }}ms</span>
    </label>
</template>

<style scoped>
.speed-control {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
}

.speed-label {
    color: var(--color-text-secondary);
}

input[type="range"] {
    width: 140px;
    accent-color: var(--state-active-bg);
}

.speed-value {
    min-width: 48px;
    font-variant-numeric: tabular-nums;
}
</style>
