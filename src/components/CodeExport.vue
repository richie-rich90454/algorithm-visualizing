<script setup lang="ts">
/**
 * CodeExport.vue – Language tabs for an educational source sketch.
 *
 * The generated code is derived from the module's pseudocode. A visible note
 * states that it is not the canonical implementation, so learners do not copy a
 * sketch into production by mistake.
 */

import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";
import { EXPORT_LANGUAGES, exportCode, type ExportLanguage } from "@/composables/codeExport";
import { copyText } from "@/composables/useShare";

const store = useVisualizerStore();
const { loadedModule } = storeToRefs(store);

/** The selected target language. */
const language = ref<ExportLanguage>("python");

/** Feedback after copying the code. */
const status = ref("");

/** Generated source for the loaded module, or an empty string. */
const code = computed(() =>
    loadedModule.value ? exportCode(loadedModule.value, language.value) : "",
);

/** Select a language and clear any stale copy feedback. */
function select(next: ExportLanguage): void {
    language.value = next;
    status.value = "";
}

/** Copy the generated source to the clipboard. */
async function copy(): Promise<void> {
    status.value = (await copyText(code.value)) ? "Code copied." : "Copy failed; select the code manually.";
}
</script>

<template>
    <div class="export-panel panel">
        <h2 class="panel-title">Code export</h2>

        <p v-if="!loadedModule" class="empty">Select an algorithm to export its logic.</p>

        <template v-else>
            <p class="disclaimer">
                Pseudocode-derived sketch, not the canonical implementation. Use it to learn the
                structure, not as tested source code.
            </p>

            <div class="language-tabs" role="group" aria-label="Export language">
                <button
                    v-for="option in EXPORT_LANGUAGES"
                    :key="option.id"
                    type="button"
                    :aria-pressed="language === option.id"
                    @click="select(option.id)"
                >
                    {{ option.label }}
                </button>
            </div>

            <pre class="code-block"><code>{{ code }}</code></pre>

            <div class="export-actions">
                <button type="button" @click="copy">Copy code</button>
                <span class="status" role="status" aria-live="polite">{{ status }}</span>
            </div>
        </template>
    </div>
</template>

<style scoped>
.export-panel {
    padding: var(--spacing-4);
    background: var(--color-bg-controls);
}

.panel-title {
    font-size: var(--font-size-heading);
    font-weight: 600;
    margin-bottom: var(--spacing-3);
}

.disclaimer {
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-3);
}

.language-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
}

.code-block {
    max-height: 320px;
    overflow: auto;
    padding: var(--spacing-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-primary);
    background: var(--color-bg-canvas);
    border: var(--border-width) solid var(--color-border-panel);
    border-radius: var(--radius);
    white-space: pre;
}

.export-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    margin-top: var(--spacing-3);
}

.status {
    color: var(--color-text-secondary);
}

.empty {
    color: var(--color-text-secondary);
}
</style>
