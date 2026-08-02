<script setup lang="ts">
/**
 * StepCounter.vue – Shows the current step position out of the total.
 *
 * Displays `step + 1 / total` (human 1-based indexing over the engine's
 * 0-based pointer). The label updates live as the user steps or plays, and
 * uses tabular numerals so the digits do not jitter while counting up.
 */

import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();
</script>

<template>
    <span class="step-counter">{{ store.stepIndex + 1 }} / {{ store.totalSteps }}</span>
</template>

<style scoped>
.step-counter {
    font-variant-numeric: tabular-nums;
    color: var(--color-text-primary);
    min-width: 72px;
    text-align: center;
}
</style>
