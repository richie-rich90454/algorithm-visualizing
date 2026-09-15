<script setup lang="ts">
/**
 * InfoPanel.vue – Educational header for the loaded algorithm.
 *
 * Shows the algorithm's name, category, time/space complexity, layout, and
 * frame count so learners always know what they are watching and what it
 * costs. Hidden entirely when no algorithm is loaded.
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();

/** The loaded algorithm metadata plus live frame count. */
const { algorithm, totalSteps } = storeToRefs(store);

/** Rows for the info table, built only when an algorithm is present. */
const rows = computed(() => {
    const module = algorithm.value;
    if (!module) {
        return [];
    }
    return [
        { key: "Name", value: module.name },
        { key: "Category", value: module.category },
        { key: "Time", value: module.complexity.time },
        { key: "Space", value: module.complexity.space },
        { key: "View", value: module.visualType },
        { key: "Steps", value: String(totalSteps.value) },
    ];
});
</script>

<template>
    <div v-if="algorithm" class="info-panel panel">
        <h2 class="info-title">About this algorithm</h2>
        <dl class="info-table">
            <template v-for="row in rows" :key="row.key">
                <dt>{{ row.key }}</dt>
                <dd>{{ row.value }}</dd>
            </template>
        </dl>
    </div>
</template>

<style scoped>
.info-panel {
    padding: var(--spacing-4);
    background: var(--color-bg-controls);
}

.info-title {
    font-size: var(--font-size-heading);
    font-weight: 600;
    margin-bottom: var(--spacing-3);
}

.info-table {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--spacing-1) var(--spacing-4);
    margin: 0;
}

.info-table dt {
    color: var(--color-text-secondary);
}

.info-table dd {
    color: var(--color-text-primary);
    text-align: right;
    font-variant-numeric: tabular-nums;
}
</style>
