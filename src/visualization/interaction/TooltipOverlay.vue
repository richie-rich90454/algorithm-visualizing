<script setup lang="ts">
/**
 * TooltipOverlay.vue – The floating info card that follows the cursor.
 *
 * When the user hovers an entity for more than ~200ms, this teleported card
 * appears near the cursor with everything worth knowing about that entity:
 * its label, its raw value, its visual state, and the full metadata table
 * (row/col/parentId/weights — whatever the algorithm stashed there).
 *
 * The card is a flat white panel (1px border, 4px radius, 8px padding) that
 * is clamped to the viewport so it never gets cut off at the screen edge.
 */

import { computed } from "vue";
import type { VisualEntity } from "@/types";

/** The hovered entity to describe; null hides the card. */
const props = defineProps<{
    entity: VisualEntity | null;
    mouseX: number;
    mouseY: number;
}>();

/** Vertical offset between the cursor and the card's top-left corner. */
const OFFSET = 10;

/** A small table of the entity's metadata for the tooltip body. */
const metadataEntries = computed(() => {
    if (!props.entity) {
        return [];
    }
    return Object.entries(props.entity.metadata);
});

/**
 * Position the card next to the cursor, keeping it inside the viewport.
 * The card is ~220px wide and up to ~200px tall; the clamp is a good
 * approximation that keeps the card on screen without measuring it.
 */
const cardStyle = computed(() => {
    const x = Math.min(props.mouseX + OFFSET, window.innerWidth - 240);
    const y = Math.min(props.mouseY + OFFSET, window.innerHeight - 220);
    return { left: `${x}px`, top: `${y}px` };
});
</script>

<template>
    <!-- Teleport to <body> so the card floats above every other element. -->
    <Teleport to="body">
        <div v-if="entity" class="tooltip" :style="cardStyle">
            <div class="tooltip-label">{{ entity.label }}</div>

            <dl class="tooltip-table">
                <dt>value</dt>
                <dd>{{ entity.value }}</dd>
                <dt>state</dt>
                <dd>{{ entity.state }}</dd>
                <template v-for="[key, value] in metadataEntries" :key="key">
                    <dt>{{ key }}</dt>
                    <dd>{{ value }}</dd>
                </template>
            </dl>
        </div>
    </Teleport>
</template>

<style scoped>
.tooltip {
    position: fixed;
    z-index: 100;
    min-width: 180px;
    max-width: 240px;
    padding: 8px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    box-shadow: none; /* flat design: no shadows */
    pointer-events: none; /* the card never blocks the canvas beneath it */
}

.tooltip-label {
    font-weight: 600;
    font-size: 14px;
    color: #111827;
    margin-bottom: 4px;
}

.tooltip-table {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
}

.tooltip-table dt {
    color: #6b7280;
}

.tooltip-table dd {
    color: #111827;
    word-break: break-all;
}
</style>
