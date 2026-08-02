<script setup lang="ts">
/**
 * StatsPanel.vue – Live counters from the current frame's meta data.
 *
 * Algorithms attach a `meta` object to each frame holding running statistics
 * like `comparisons`, `swaps`, `visits`, or accumulated distances. This panel
 * renders those numbers as a small table that updates on every step, so
 * learners can watch the counters climb as the algorithm progresses.
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();

/** Reactive store values so the counters refresh as the frame changes. */
const { currentFrame } = storeToRefs(store);

/** The meta entries of the current frame, as key/value pairs. */
const statEntries = computed(() => {
    const meta = currentFrame.value?.meta;
    if (!meta) {
        return [];
    }
    return Object.entries(meta);
});
</script>

<template>
    <div class="stats-panel panel">
        <h2 class="panel-title">Statistics</h2>

        <p v-if="statEntries.length === 0" class="panel-empty">No statistics for this step.</p>

        <dl v-else class="stats-table">
            <template v-for="[key, value] in statEntries" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ value }}</dd>
            </template>
        </dl>
    </div>
</template>

<style scoped>
.stats-panel {
    padding: var(--spacing-4);
    background: var(--color-bg-controls);
}

.panel-title {
    font-size: var(--font-size-heading);
    font-weight: 600;
    margin-bottom: var(--spacing-3);
}

.panel-empty {
    color: var(--color-text-secondary);
}

.stats-table {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--spacing-1) var(--spacing-4);
    margin: 0;
}

.stats-table dt {
    color: var(--color-text-secondary);
    text-transform: capitalize;
}

.stats-table dd {
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    text-align: right;
}
</style>
