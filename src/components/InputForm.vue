<script setup lang="ts">
/**
 * InputForm.vue – Friendly input editor for the loaded algorithm.
 *
 * Fields are derived from the module's `defaultInput` shape: numbers, text,
 * toggles, comma-separated lists, one-row-per-line matrices, and a JSON editor
 * for nested data. A JSON tab edits the whole input at once. Submission runs
 * the algorithm again with the edited value and reports plain-language errors
 * before anything is executed.
 */

import { computed, ref, watch } from "vue";
import { useVisualizerStore } from "@/stores/visualizer";
import {
    buildInput,
    describeInput,
    inputShape,
    randomizeInput,
    type InputField,
    type InputShape,
} from "@/composables/inputSchema";

const store = useVisualizerStore();

/** Fields describing the currently loaded algorithm's input. */
const fields = ref<InputField[]>([]);

/** Edited text for each friendly field. */
const edits = ref<Record<string, string>>({});

/** Whole-input JSON shown in advanced mode. */
const jsonText = ref("");

/** True while the advanced JSON editor is visible. */
const jsonMode = ref(false);

/** Validation or parse error, shown above the Run button. */
const error = ref("");

/** Confirmation shown after a successful run. */
const notice = ref("");

/** The shape of the loaded algorithm's default input. */
const shape = computed<InputShape>(() => inputShape(store.algorithm?.defaultInput ?? null));

/** Refill the editors from the loaded algorithm's default input. */
function populate(value: unknown): void {
    const next = describeInput(value);
    fields.value = next;
    const raw: Record<string, string> = {};
    for (const field of next) {
        raw[field.key] = field.initial;
    }
    edits.value = raw;
    jsonText.value = JSON.stringify(value, null, 2);
    error.value = "";
    notice.value = "";
}

// Rebuild the form whenever a different algorithm is selected.
watch(
    () => store.algorithm?.id,
    () => populate(store.algorithm?.defaultInput ?? null),
    { immediate: true },
);

/** Restore the default values without running the algorithm. */
function useDefault(): void {
    populate(store.algorithm?.defaultInput ?? null);
    notice.value = "Default values restored. Select Run to apply them.";
}

/** Fill the editors with a same-shaped randomized input. */
function useRandom(): void {
    const random = randomizeInput(store.algorithm?.defaultInput ?? null);
    populate(random);
    notice.value = "Random values generated. Select Run to apply them.";
}

/** Switch editors, carrying the current friendly values into JSON mode. */
function toggleJson(): void {
    if (!jsonMode.value) {
        const parsed = buildInput(fields.value, edits.value, shape.value);
        if (parsed.ok) {
            jsonText.value = JSON.stringify(parsed.value, null, 2);
        }
    }
    jsonMode.value = !jsonMode.value;
    error.value = "";
    notice.value = "";
}

/** Validate the edits, then re-run the algorithm with the parsed input. */
function run(): void {
    error.value = "";
    notice.value = "";
    let parsed;
    if (jsonMode.value) {
        try {
            parsed = { ok: true as const, value: JSON.parse(jsonText.value) as unknown };
        } catch {
            parsed = { ok: false as const, error: "Enter valid JSON, using double quotes around names." };
        }
    } else {
        parsed = buildInput(fields.value, edits.value, shape.value);
    }

    if (!parsed.ok) {
        error.value = parsed.error;
        return;
    }

    store.runWithInput(parsed.value);
    notice.value = "Input applied. The algorithm restarted from the first step.";
}
</script>

<template>
    <div class="input-panel panel">
        <h2 class="panel-title">Input</h2>

        <p v-if="!store.algorithm" class="empty">Select an algorithm to edit its input.</p>

        <template v-else>
            <div class="input-toolbar">
                <button type="button" @click="useDefault">Default</button>
                <button type="button" @click="useRandom">Random</button>
                <button
                    type="button"
                    :aria-pressed="jsonMode"
                    @click="toggleJson"
                >
                    {{ jsonMode ? "Friendly form" : "Advanced JSON" }}
                </button>
            </div>

            <template v-if="jsonMode">
                <label class="field-label" for="input-json">Full input as JSON</label>
                <textarea
                    id="input-json"
                    v-model="jsonText"
                    class="json-editor"
                    rows="10"
                    spellcheck="false"
                ></textarea>
            </template>

            <template v-else>
                <div v-for="field in fields" :key="field.key" class="field">
                    <label class="field-label" :for="`input-${field.key}`">{{ field.label }}</label>

                    <input
                        v-if="field.kind === 'number'"
                        :id="`input-${field.key}`"
                        v-model="edits[field.key]"
                        type="number"
                        class="field-input"
                    />
                    <input
                        v-else-if="field.kind === 'string'"
                        :id="`input-${field.key}`"
                        v-model="edits[field.key]"
                        type="text"
                        class="field-input"
                    />
                    <input
                        v-else-if="field.kind === 'boolean'"
                        :id="`input-${field.key}`"
                        type="checkbox"
                        :checked="edits[field.key] === 'true'"
                        @change="edits[field.key] = ($event.target as HTMLInputElement).checked ? 'true' : 'false'"
                    />
                    <textarea
                        v-else-if="field.kind === 'numberMatrix' || field.kind === 'stringMatrix'"
                        :id="`input-${field.key}`"
                        v-model="edits[field.key]"
                        class="field-input"
                        rows="4"
                        spellcheck="false"
                    ></textarea>
                    <textarea
                        v-else-if="field.kind === 'complex'"
                        :id="`input-${field.key}`"
                        v-model="edits[field.key]"
                        class="field-input"
                        rows="4"
                        spellcheck="false"
                    ></textarea>
                    <input
                        v-else
                        :id="`input-${field.key}`"
                        v-model="edits[field.key]"
                        type="text"
                        class="field-input"
                    />

                    <p class="field-hint">{{ field.hint }}</p>
                </div>
            </template>

            <p v-if="error" class="message error" role="alert">{{ error }}</p>
            <p v-if="notice" class="message notice" role="status">{{ notice }}</p>

            <button type="button" class="run-button" @click="run">Run algorithm</button>
        </template>
    </div>
</template>

<style scoped>
.input-panel {
    padding: var(--spacing-4);
    background: var(--color-bg-controls);
}

.panel-title {
    font-size: var(--font-size-heading);
    font-weight: 600;
    margin-bottom: var(--spacing-3);
}

.input-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
}

.field + .field {
    margin-top: var(--spacing-3);
}

.field-label {
    display: block;
    font-weight: 500;
    margin-bottom: var(--spacing-1);
}

.field-input,
.json-editor {
    width: 100%;
    padding: 6px 8px;
    font-family: var(--font-family);
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    background: var(--color-bg-canvas);
    border: var(--border-width) solid var(--state-idle-border);
    border-radius: var(--radius);
}

.json-editor,
.field-input[rows] {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    resize: vertical;
}

.field-hint {
    margin-top: var(--spacing-1);
    font-size: 12px;
    color: var(--color-text-secondary);
}

.message {
    margin-top: var(--spacing-3);
}

.error {
    color: var(--state-error-border);
}

.notice {
    color: var(--color-text-secondary);
}

.run-button {
    margin-top: var(--spacing-3);
    border-color: var(--state-active-border);
    color: var(--state-active-border);
}

.empty {
    color: var(--color-text-secondary);
}
</style>
