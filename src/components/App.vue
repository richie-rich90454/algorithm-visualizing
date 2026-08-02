<script setup lang="ts">
/**
 * App.vue – Root layout of the Algorithmic Visualization Engine.
 *
 * Structure (plan Section 12.1):
 *   - A 280px `<Sidebar>` on the left holding search + the category tree.
 *   - A `<main>` area on the right stacking the canvas visualiser, a 40px
 *     description bar showing the current frame's caption, and the 56px
 *     controls bar with playback buttons.
 *
 * Global keyboard shortcuts (Space / ArrowLeft / ArrowRight / R) are added in
 * a later commit; all playback state flows through the Pinia store.
 */

import { useVisualizerStore } from "@/stores/visualizer";
import Sidebar from "./Sidebar.vue";
import VisualContainer from "./VisualContainer.vue";
import ControlsBar from "./ControlsBar.vue";
import InfoPanel from "./InfoPanel.vue";
import PseudocodePanel from "./PseudocodePanel.vue";
import StatsPanel from "./StatsPanel.vue";

const store = useVisualizerStore();
</script>

<template>
    <div id="app">
        <Sidebar />

        <main class="visualizer-area">
            <VisualContainer />

            <!-- The 40px description bar mirrors the canvas overlay caption. -->
            <div class="description-bar">
                {{ store.currentFrame?.description ?? "Select an algorithm to begin." }}
            </div>

            <ControlsBar />
        </main>

        <aside class="info-area">
            <InfoPanel />
            <PseudocodePanel />
            <StatsPanel />
        </aside>
    </div>
</template>

<style scoped>
.visualizer-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    background: var(--color-bg-canvas);
}

.description-bar {
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 var(--spacing-4);
    background: var(--color-bg-description);
    border-top: var(--border-width) solid var(--color-border-panel);
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.info-area {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    overflow-y: auto;
    padding: var(--spacing-3);
    background: var(--color-bg-sidebar);
    border-left: var(--border-width) solid var(--color-border-panel);
}
</style>
