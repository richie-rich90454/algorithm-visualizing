<script setup lang="ts">
 /**
 * App.vue – Root layout of the Algorithmic Visualization Engine.
 *
 * Structure (per plan Section 12.1):
 *   - A 280px `<Sidebar>` on the left holding search + category tree.
 *   - A `<main>` area on the right stacking the canvas visualiser, the
 *     description bar, and the controls bar.
 *
 * This file is expanded across the foundation commits; at this stage it only
 * renders the empty shell. The keyboard shortcuts (Space / arrows / R) are
 * wired up in the final polish commit.
 */
</script>

<template>
    <div id="app">
        <aside class="sidebar">
            <h1>Algorithms</h1>
        </aside>
        <main class="visualizer-area">
            <p class="placeholder">Select an algorithm from the sidebar to begin.</p>
        </main>
    </div>
</template>

<style scoped>
.sidebar {
    width: 280px;
    flex-shrink: 0;
    background: var(--color-bg-sidebar);
    border-right: 1px solid var(--color-border-panel);
    padding: var(--spacing-4);
}

.visualizer-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.placeholder {
    color: var(--color-text-secondary);
}
</style>
