<script setup lang="ts">
/**
 * PseudocodePanel.vue – Textbook pseudocode with per-step highlighting.
 *
 * Shows the loaded module's `pseudocode` lines and highlights the line
 * matching the current frame's `codeLineNumber`, so learners correlate each
 * visual step with the abstract logic. When a module has no pseudocode yet,
 * falls back to a short generic outline (never blank).
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();

/** Reactive store values so the panel updates on every step. */
const { currentFrame, algorithm, loadedModule } = storeToRefs(store);

/** Generic outline used only when a module omits pseudocode. */
const fallbackLines = [
    "Start the algorithm with the given input",
    "Inspect the current element (highlighted)",
    "Compare / update according to the algorithm rule",
    "Move to the next element",
    "Repeat until the input is fully processed",
    "Finish: show the final state",
];

/** Real pseudocode when available, otherwise the generic outline. */
const lines = computed(() => {
    const pc = loadedModule.value?.pseudocode;
    return pc && pc.length > 0 ? pc : fallbackLines;
});

/** The currently highlighted line, clamped into range. */
const highlightedLine = computed(() => {
    const n = currentFrame.value?.codeLineNumber ?? 0;
    if (n < 0) return 0;
    return n >= lines.value.length ? lines.value.length - 1 : n;
});
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
                    v-for="(line, index) in lines"
                    :key="index"
                    :class="{ active: index === highlightedLine }"
                >
                    <span class="line-no">{{ index + 1 }}</span>{{ line }}
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
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 13px;
    line-height: 1.6;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mock-lines li {
    display: flex;
    gap: 8px;
    padding: 2px 4px;
    border-radius: var(--radius);
}

.line-no {
    flex-shrink: 0;
    min-width: 20px;
    text-align: right;
    color: var(--color-text-secondary);
    user-select: none;
}

.mock-lines li.active {
    background: var(--state-highlight-bg);
}
</style>
