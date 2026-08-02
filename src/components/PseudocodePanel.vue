<script setup lang="ts">
/**
 * PseudocodePanel.vue – Displays the current frame's step description.
 *
 * A placeholder panel for a future full pseudocode view. For now it shows the
 * algorithm's name plus the current step description, and highlights the line
 * corresponding to `codeLineNumber` when the algorithm supplies one.
 *
 * The mock pseudocode list is intentionally short: when an algorithm sets a
 * `codeLineNumber`, the matching mock line is highlighted so the learner can
 * correlate the visual step with an abstract line of logic.
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();

/** Reactive store values so the panel updates on every step. */
const { currentFrame, algorithm } = storeToRefs(store);

/** Mock pseudocode lines; line 0 is highlighted by default. */
const mockLines = [
    "Start the algorithm with the given input",
    "Inspect the current element (highlighted)",
    "Compare / update according to the algorithm rule",
    "Move to the next element",
    "Repeat until the input is fully processed",
    "Finish: show the final state",
];

/** The currently highlighted mock line, driven by the frame's code line. */
const highlightedLine = computed(() => currentFrame.value?.codeLineNumber ?? 0);
</script>

<template>
    <div class="pseudocode-panel panel">
        <h2 class="panel-title">Pseudocode</h2>

        <p v-if="!algorithm" class="panel-empty">Select an algorithm to see its steps.</p>

        <template v-else>
            <p class="step-description">
                {{ currentFrame?.description ?? "Loading…" }}
            </p>

            <ol class="mock-lines">
                <li
                    v-for="(line, index) in mockLines"
                    :key="index"
                    :class="{ active: index === highlightedLine }"
                >
                    {{ line }}
                </li>
            </ol>
        </template>
    </div>
</template>

<style scoped>
.pseudocode-panel {
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

.step-description {
    margin-bottom: var(--spacing-3);
    color: var(--color-text-primary);
}

.mock-lines {
    list-style-position: inside;
    margin: 0;
    padding: 0;
    font-size: 13px;
    line-height: 1.6;
}

.mock-lines li.active {
    background: var(--state-highlight-bg);
    border-radius: var(--radius);
    padding-left: var(--spacing-1);
}
</style>
