<script setup lang="ts">
/**
 * StepCounter.vue – Shows the current step position out of the total.
 *
 * Displays `step + 1 / total` (human 1-based indexing over the engine's
 * 0-based pointer). The label updates live as the user steps or plays, and
 * uses tabular numerals so the digits do not jitter while counting up.
 * With no algorithm loaded the total is zero, so it shows an honest `0 / 0`
 * instead of `1 / 0`.
 */

import { computed } from "vue";
import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();

const isEmpty = computed(() => store.totalSteps === 0);
const label = computed(() =>
    isEmpty.value ? "0 / 0" : `${store.stepIndex + 1} / ${store.totalSteps}`,
);
const hint = computed(() => (isEmpty.value ? "No algorithm selected" : undefined));
</script>

<template>
    <span class="step-counter" :title="hint" :aria-label="hint">{{ label }}</span>
</template>

<style scoped>
.step-counter {
    font-variant-numeric: tabular-nums;
    color: var(--color-text-primary);
    min-width: 72px;
    text-align: center;
}
</style>
