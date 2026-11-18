<script setup lang="ts">
/**
 * TextAlternative.vue – A text description of the current canvas frame.
 *
 * Screen readers cannot interpret a <canvas>, so this collapsible section
 * lists the frame's caption, its entities (with labels and states), and its
 * edges. A short summary keeps the page usable at a glance while the full list
 * remains available on demand.
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();
const { currentFrame } = storeToRefs(store);

/** Cap the list so a 59-cell frame does not flood the panel. */
const MAX_ITEMS = 40;

/** Human-readable entity rows, truncated with a count of omitted items. */
const entities = computed(() => {
    const frame = currentFrame.value;
    if (!frame) {
        return [];
    }
    const rows = frame.entities.map((entity) => `${entity.label || entity.id} (${entity.state})`);
    const shown = rows.slice(0, MAX_ITEMS);
    if (rows.length > MAX_ITEMS) {
        shown.push(`and ${rows.length - MAX_ITEMS} more entities`);
    }
    return shown;
});

/** Human-readable edge rows, truncated with a count of omitted items. */
const edges = computed(() => {
    const frame = currentFrame.value;
    if (!frame) {
        return [];
    }
    const rows = frame.edges.map((edge) => {
        const weight = edge.label ? `, weight ${edge.label}` : "";
        return `${edge.sourceId} to ${edge.targetId}${weight} (${edge.state})`;
    });
    const shown = rows.slice(0, MAX_ITEMS);
    if (rows.length > MAX_ITEMS) {
        shown.push(`and ${rows.length - MAX_ITEMS} more edges`);
    }
    return shown;
});
</script>

<template>
    <details class="text-alternative panel">
        <summary>Text alternative for this step</summary>
        <div class="text-alternative-body">
            <p class="frame-caption">
                {{ currentFrame?.description ?? "No algorithm is loaded yet." }}
            </p>
            <h3>Entities</h3>
            <p v-if="entities.length === 0" class="empty">No entities in this step.</p>
            <ul v-else>
                <li v-for="(item, index) in entities" :key="index">{{ item }}</li>
            </ul>
            <h3>Connections</h3>
            <p v-if="edges.length === 0" class="empty">No connections in this step.</p>
            <ul v-else>
                <li v-for="(item, index) in edges" :key="index">{{ item }}</li>
            </ul>
        </div>
    </details>
</template>

<style scoped>
.text-alternative {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-bg-controls);
}

summary {
    cursor: pointer;
    font-weight: 500;
}

.text-alternative-body {
    margin-top: var(--spacing-3);
}

.text-alternative-body h3 {
    font-size: var(--font-size-base);
    margin-top: var(--spacing-3);
    margin-bottom: var(--spacing-1);
}

.frame-caption {
    margin-bottom: var(--spacing-2);
}

ul {
    list-style: disc;
    padding-left: var(--spacing-5);
}

.empty {
    color: var(--color-text-secondary);
}
</style>
