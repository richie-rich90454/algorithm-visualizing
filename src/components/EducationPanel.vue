<script setup lang="ts">
/**
 * EducationPanel.vue – Structured writeup for the loaded algorithm.
 *
 * Shows intuition, invariants, a correctness sketch, the complexity
 * rationale, real-world uses, references, and a worked example. The data lives
 * on the executable module (not the lightweight manifest metadata), so the
 * panel reads `loadedModule` and renders nothing until an authored writeup is
 * present. Every section uses a real heading so screen readers can navigate
 * the panel by heading.
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";
import type { AlgorithmEducation } from "@/types";

const store = useVisualizerStore();
const { loadedModule } = storeToRefs(store);

/** The optional writeup attached to the loaded module. */
const education = computed<AlgorithmEducation | null>(() => loadedModule.value?.education ?? null);
</script>

<template>
    <div v-if="education" class="education-panel panel">
        <h2 class="panel-title">Learn</h2>

        <section class="education-section">
            <h3>Intuition</h3>
            <p>{{ education.intuition }}</p>
        </section>

        <section v-if="education.invariants.length > 0" class="education-section">
            <h3>Key invariants</h3>
            <ul>
                <li v-for="(item, index) in education.invariants" :key="index">{{ item }}</li>
            </ul>
        </section>

        <section class="education-section">
            <h3>Why it works</h3>
            <p>{{ education.correctness }}</p>
        </section>

        <section class="education-section">
            <h3>Complexity explained</h3>
            <p>{{ education.complexityRationale }}</p>
        </section>

        <section v-if="education.uses.length > 0" class="education-section">
            <h3>Real-world uses</h3>
            <ul>
                <li v-for="(item, index) in education.uses" :key="index">{{ item }}</li>
            </ul>
        </section>

        <section v-if="education.references.length > 0" class="education-section">
            <h3>References</h3>
            <ul>
                <li v-for="(item, index) in education.references" :key="index">{{ item }}</li>
            </ul>
        </section>

        <section class="education-section">
            <h3>Worked example</h3>
            <p>{{ education.workedExample }}</p>
        </section>
    </div>
</template>

<style scoped>
.education-panel {
    padding: var(--spacing-4);
    background: var(--color-bg-controls);
}

.panel-title {
    font-size: var(--font-size-heading);
    font-weight: 600;
    margin-bottom: var(--spacing-3);
}

.education-section + .education-section {
    margin-top: var(--spacing-4);
    padding-top: var(--spacing-3);
    border-top: var(--border-width) solid var(--color-border-panel);
}

.education-section h3 {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-1);
}

.education-section p {
    color: var(--color-text-primary);
}

.education-section ul {
    list-style: disc;
    padding-left: var(--spacing-5);
    color: var(--color-text-primary);
}

.education-section li + li {
    margin-top: var(--spacing-1);
}
</style>
