<script setup lang="ts">
/**
 * ComparePanel.vue – Sets up and summarizes a side-by-side run.
 *
 * The first algorithm is the one selected in the sidebar. This panel picks the
 * second algorithm; both then run on the same input and share the step controls
 * in the ControlsBar. The counters show each run's current step and its most
 * relevant operation count from the frame metadata.
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { getAllAlgorithms } from "@/core";
import { useVisualizerStore } from "@/stores/visualizer";
import type { VisualFrame } from "@/types";

const store = useVisualizerStore();
const { algorithmId, algorithm, compareId, compareAlgorithm, isCompareMode, stepIndex, compareStepIndex, totalSteps, compareTotalSteps, currentFrame, compareFrame } = storeToRefs(store);

/** Algorithms available as the second run, excluding the first one. */
const choices = computed(() => getAllAlgorithms().filter((item) => item.id !== algorithmId.value));

/** @returns The most relevant running count for a frame. */
function operations(frame: VisualFrame | null): number {
    if (!frame) {
        return 0;
    }
    for (const key of ["comparisons", "ops", "operations", "visits", "swaps", "steps"]) {
        const value = frame.meta[key];
        if (typeof value === "number") {
            return value;
        }
    }
    return frame.entities.length;
}

/** Change or clear the second algorithm. */
function onChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    void store.setCompareAlgorithm(id === "" ? null : id);
}
</script>

<template>
    <div class="compare-panel panel">
        <h2 class="panel-title">Compare mode</h2>

        <p v-if="!algorithm" class="empty">Select the first algorithm from the list, then choose a second one here.</p>

        <template v-else>
            <label class="field-label" for="compare-select">Second algorithm</label>
            <select id="compare-select" class="compare-select" :value="compareId ?? ''" @change="onChange">
                <option value="">Off</option>
                <option v-for="item in choices" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>

            <template v-if="isCompareMode">
                <div class="compare-grid">
                    <div class="compare-column">
                        <h3>A: {{ algorithm?.name }}</h3>
                        <p>Step {{ stepIndex + 1 }} of {{ totalSteps }}</p>
                        <p>Operations: {{ operations(currentFrame) }}</p>
                    </div>
                    <div class="compare-column">
                        <h3>B: {{ compareAlgorithm?.name }}</h3>
                        <p>Step {{ compareStepIndex + 1 }} of {{ compareTotalSteps }}</p>
                        <p>Operations: {{ operations(compareFrame) }}</p>
                    </div>
                </div>
                <p class="hint">Both runs share the input form and the playback controls above.</p>
            </template>
        </template>
    </div>
</template>

<style scoped>
.compare-panel {
    padding: var(--spacing-4);
    background: var(--color-bg-controls);
}

.panel-title {
    font-size: var(--font-size-heading);
    font-weight: 600;
    margin-bottom: var(--spacing-3);
}

.field-label {
    display: block;
    font-weight: 500;
    margin-bottom: var(--spacing-1);
}

.compare-select {
    width: 100%;
    padding: 6px 8px;
    font-family: var(--font-family);
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    background: var(--color-bg-canvas);
    border: var(--border-width) solid var(--state-idle-border);
    border-radius: var(--radius);
}

.compare-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-3);
    margin-top: var(--spacing-3);
}

.compare-column {
    padding: var(--spacing-2);
    border: var(--border-width) solid var(--color-border-panel);
    border-radius: var(--radius);
}

.compare-column h3 {
    font-size: var(--font-size-base);
    margin-bottom: var(--spacing-1);
}

.compare-column p,
.hint {
    font-size: 12px;
    color: var(--color-text-secondary);
}

.hint {
    margin-top: var(--spacing-3);
}

.empty {
    color: var(--color-text-secondary);
}
</style>
