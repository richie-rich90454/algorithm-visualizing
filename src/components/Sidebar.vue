<script setup lang="ts">
/**
 * Sidebar.vue – The 280px left column holding search + the category tree.
 *
 * A fixed-width flex column: a header ("Algorithms"), the debounced search
 * box, and the collapsible category tree. The tree automatically highlights
 * whichever algorithm is currently loaded, driven entirely by the store.
 */

import { ref } from "vue";
import CategoryTree from "./CategoryTree.vue";
import SearchBar from "./SearchBar.vue";

/** The current search query, kept here so the tree can filter by it. */
const query = ref("");
</script>

<template>
    <aside class="sidebar">
        <h1 class="sidebar-title">Algorithms</h1>

        <!-- The search box emits an update event once the user pauses typing. -->
        <div class="sidebar-search">
            <SearchBar @update="(value: string) => (query = value)" />
        </div>

        <!-- The tree re-renders whenever the query changes. -->
        <div class="sidebar-tree">
            <CategoryTree :query="query" />
        </div>
    </aside>
</template>

<style scoped>
.sidebar {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-sidebar);
    border-right: var(--border-width) solid var(--color-border-panel);
}

.sidebar-title {
    padding: var(--spacing-4) var(--spacing-4) var(--spacing-3);
    font-weight: 600;
    font-size: var(--font-size-heading);
}

.sidebar-search {
    padding: 0 var(--spacing-4) var(--spacing-3);
}

.sidebar-tree {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--spacing-2) var(--spacing-4);
}
</style>
