<script setup lang="ts">
/**
 * VisualContainer.vue – The canvas, its render loop, and all mouse input.
 *
 * This is the heart of the application. It owns the `<canvas>`, keeps its
 * backing store sized for the device's pixel ratio, and runs a single
 * `requestAnimationFrame` loop that redraws only when the frame changed
 * (a dirty flag, per plan Section 0.9).
 *
 * Rendering pipeline per frame:
 *   1. Resolve the layout engine for the frame's `layout` type.
 *   2. Position every entity (layouts mutate entities in place).
 *   3. Draw edges, entities, overflow labels, then the overlay.
 *
 * Mouse handling:
 *   - `mousemove` → hit-test → schedule a tooltip after 200ms of hovering.
 *   - `click`     → select the entity (or clear the selection).
 *
 * Everything is cleaned up on unmount: observers, timers, and the rAF loop.
 */

import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";
import { DPR, getLogicalCoords, scaleContext } from "@/visualization/HiDPI";
import { applyArrayLayout } from "@/visualization/layout/ArrayLayout";
import { applyGraphLayout } from "@/visualization/layout/GraphLayout";
import { applyGridLayout } from "@/visualization/layout/GridLayout";
import { applyPointLayout } from "@/visualization/layout/PointLayout";
import { applyTextLayout } from "@/visualization/layout/TextLayout";
import { applyTreeLayout } from "@/visualization/layout/TreeLayout";
import { renderEdges } from "@/visualization/renderers/EdgeRenderer";
import { renderEntities } from "@/visualization/renderers/EntityRenderer";
import { renderLabels } from "@/visualization/renderers/LabelRenderer";
import { renderOverlay } from "@/visualization/renderers/OverlayRenderer";
import { hitTest } from "@/visualization/interaction/HitTester";
import TooltipOverlay from "@/visualization/interaction/TooltipOverlay.vue";
import type { LayoutType, VisualEntity } from "@/types";

const store = useVisualizerStore();

/** The canvas element, reached through the template ref. */
const canvasEl = ref<HTMLCanvasElement | null>(null);

/** The current frame reference, so layouts only re-run when it changes. */
let lastFrameKey: object | null = null;

/** Dirty flag – set whenever a redraw is needed; read by the rAF loop. */
let dirty = true;

/** The canvas 2D context, acquired once on mount. */
let ctx: CanvasRenderingContext2D | null = null;

/** Resize observer for keeping the canvas size in sync with the container. */
let resizeObserver: ResizeObserver | null = null;

/** Handle of the rAF loop so it can be canceled on unmount. */
let rafId = 0;

/** The entity currently hovered (drives the tooltip), or null. */
const hoveredEntity = ref<VisualEntity | null>(null);

/** Logical cursor position, fed to the tooltip for positioning. */
const mousePos = ref({ x: 0, y: 0 });

/** Timer handle for the 200ms hover delay before showing the tooltip. */
let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

/** The frame currently displayed; reference identity drives the dirty flag. */
const { currentFrame, selectedEntity } = storeToRefs(store);

// Mark the canvas dirty whenever the engine steps to a new frame. Each frame
// is a distinct object, so comparing by reference is enough.
watch(currentFrame, () => {
    dirty = true;
});

/** The currently selected entity (from the store), for the overlay outline. */

// The selected entity lives in the store; a redraw must occur when it changes.
watch(selectedEntity, () => {
    dirty = true;
});

/**
 * Size the canvas backing store to the container's physical pixels and scale
 * the context so every draw command stays in logical CSS pixels.
 */
function resizeCanvas(): void {
    const canvas = canvasEl.value;
    const ctx2d = ctx;
    if (!canvas || !ctx2d) {
        return;
    }

    const { clientWidth, clientHeight } = canvas;
    canvas.width = Math.max(1, Math.round(clientWidth * DPR));
    canvas.height = Math.max(1, Math.round(clientHeight * DPR));
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    scaleContext(ctx2d, DPR);

    // A resize may reflow the layout, so force a redraw and re-layout.
    lastFrameKey = null;
    dirty = true;
}

/**
 * Apply the layout engine matching the frame's declared layout type.
 */
function applyLayout(): void {
    const canvas = canvasEl.value;
    const frame = store.currentFrame;
    if (!canvas || !frame) {
        return;
    }

    // Only re-run layout when a *different* frame arrives; the layout engines
    // mutate entities in place, so re-running on the same frame is pointless.
    if (frame === lastFrameKey) {
        return;
    }
    lastFrameKey = frame;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Dispatch to the layout engine the algorithm asked for.
    switch (frame.layout as LayoutType) {
        case "array":
            applyArrayLayout(frame, w, h);
            break;
        case "grid":
        case "matrix":
            applyGridLayout(frame, w, h);
            break;
        case "tree":
            applyTreeLayout(frame, w, h);
            break;
        case "graph":
            applyGraphLayout(frame, w, h);
            break;
        case "text":
            applyTextLayout(frame, w, h);
            break;
        case "point":
            applyPointLayout(frame, w, h);
            break;
    }
}

/**
 * Draw the current frame: edges first, entities, labels, then the overlay.
 */
function draw(): void {
    const canvas = canvasEl.value;
    const frame = store.currentFrame;
    if (!canvas || !ctx || !frame) {
        return;
    }

    // Wipe the canvas to white before repainting.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // Edges first so nodes are painted on top of their connecting lines.
    renderEdges(ctx, frame);
    renderEntities(ctx, frame);
    renderLabels(ctx, frame);
    renderOverlay(
        ctx,
        frame,
        canvas.clientWidth,
        canvas.clientHeight,
        store.totalSteps,
        store.selectedEntity,
    );
}

/**
 * The single requestAnimationFrame loop. It redraws only when something marked
 * the canvas dirty, otherwise it idles cheaply at 60fps.
 */
function renderLoop(): void {
    rafId = requestAnimationFrame(renderLoop);
    // The canvas only dances when it is asked to – lazy like a well-rested cat.
    if (!dirty) {
        return;
    }
    dirty = false;
    applyLayout();
    draw();
}

/** Convert a mouse event to logical canvas coordinates and hit-test it. */
function handleMouseMove(event: MouseEvent): void {
    const canvas = canvasEl.value;
    if (!canvas || !store.currentFrame) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const { x, y } = getLogicalCoords(event.clientX, event.clientY, rect, DPR);

    mousePos.value = { x, y };

    // Find what the cursor is over, then schedule the tooltip to appear once
    // the user has hovered it for 200ms.
    const hit = hitTest(store.currentFrame.entities, x, y);
    hoveredEntity.value = hit;

    if (tooltipTimer) {
        clearTimeout(tooltipTimer);
    }
    tooltipTimer = setTimeout(() => {
        tooltipTimer = null;
    }, 200);
}

/** Hide the tooltip when the cursor leaves the canvas entirely. */
function handleMouseLeave(): void {
    hoveredEntity.value = null;
    if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
    }
}

/** Clicking an entity selects it (or deselects when clicking empty space). */
function handleClick(event: MouseEvent): void {
    const canvas = canvasEl.value;
    if (!canvas || !store.currentFrame) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const { x, y } = getLogicalCoords(event.clientX, event.clientY, rect, DPR);
    store.selectedEntity = hitTest(store.currentFrame.entities, x, y);
}

onMounted(() => {
    const canvas = canvasEl.value;
    if (!canvas) {
        return;
    }

    // Acquire the 2D context once and size the canvas for the pixel ratio.
    ctx = canvas.getContext("2d");
    resizeCanvas();

    // Keep the canvas sized correctly when the container changes size.
    resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvas);

    // Start the one-and-only render loop.
    renderLoop();
});

onBeforeUnmount(() => {
    cancelAnimationFrame(rafId);
    resizeObserver?.disconnect();
    if (tooltipTimer) {
        clearTimeout(tooltipTimer);
    }
});
</script>

<template>
    <div class="visual-container">
        <canvas
            ref="canvasEl"
            class="visual-canvas"
            @mousemove="handleMouseMove"
            @mouseleave="handleMouseLeave"
            @click="handleClick"
        ></canvas>

        <!-- The floating info card follows the cursor after a 200ms hover. -->
        <TooltipOverlay :entity="hoveredEntity" :mouse-x="mousePos.x" :mouse-y="mousePos.y" />
    </div>
</template>

<style scoped>
.visual-container {
    position: relative;
    flex: 1;
    min-height: 0;
    background: #ffffff;
}

.visual-canvas {
    display: block;
    width: 100%;
    height: 100%;
}
</style>
