<script setup lang="ts">
/**
 * CategoryTree.vue – The collapsible list of algorithms, grouped by category.
 *
 * The sidebar's main content. It receives the full module list (optionally
 * filtered by the search query) and renders one expandable section per
 * category. Clicking a leaf loads that algorithm into the store.
 *
 * The component is written to be recursive in spirit: the category header is a
 * plain button and the leaves are flat list items, but the structure is kept
 * trivial here because there are exactly two levels (category → algorithm).
 */

import { computed, ref } from "vue";
import { getAllAlgorithms } from "@/core";
import type { AlgorithmMeta } from "@/core/manifest";
import { useVisualizerStore } from "@/stores/visualizer";
import type { AlgorithmCategory } from "@/types";

/** The current search query; leaves not matching it are hidden. */
const props = defineProps<{
    query: string;
}>();

const store = useVisualizerStore();

/**
 * Group all algorithms by category, preserving category order and hiding any
 * algorithm that does not match the current search query.
 */
const groups = computed(() => {
    const q = props.query.trim().toLowerCase();

    // Filter the full list once; empty queries match everything.
    const filtered = getAllAlgorithms().filter((m) => {
        if (!q) {
            return true;
        }
        return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
    });

    // Bucket algorithms into their category, keeping first-seen order.
    const buckets = new Map<AlgorithmCategory, AlgorithmMeta[]>();
    for (const module of filtered) {
        const list = buckets.get(module.category) ?? [];
        list.push(module);
        buckets.set(module.category, list);
    }

    return [...buckets.entries()];
});

/** Set of categories currently expanded; defaults to the first category. */
const openCategories = ref<Set<AlgorithmCategory>>(new Set<AlgorithmCategory>(["sorting"]));

/** Toggle whether a category section is expanded. */
function toggleCategory(category: AlgorithmCategory): void {
    const next = new Set(openCategories.value);
    if (next.has(category)) {
        next.delete(category);
    } else {
        next.add(category);
    }
    openCategories.value = next;
}

/** Human-readable label for each category, used as section headers. */
const CATEGORY_LABELS: Record<AlgorithmCategory, string> = {
    sorting: "Sorting",
    searching: "Searching",
    graph: "Graph Traversal",
    "shortest-path": "Shortest Path",
    mst: "Minimum Spanning Trees",
    flow: "Network Flow",
    tree: "Tree Algorithms",
    string: "String Algorithms",
    math: "Number Theory",
    "dynamic-programming": "Dynamic Programming",
    game: "Game Theory",
    geometry: "Computational Geometry",
    "data-structures": "Data Structures",
};
</script>

<template>
    <ul class="category-list">
        <li v-for="[category, modules] in groups" :key="category" class="category">
            <button
                type="button"
                class="category-header"
                :aria-expanded="openCategories.has(category)"
                @click="toggleCategory(category)"
            >
                <span class="chevron">{{ openCategories.has(category) ? "▾" : "▸" }}</span>
                <span class="category-name">{{ CATEGORY_LABELS[category] ?? category }}</span>
                <span class="category-count">{{ modules.length }}</span>
            </button>

            <ul v-if="openCategories.has(category)" class="leaf-list">
                <li v-for="module in modules" :key="module.id">
                    <button
                        type="button"
                        class="leaf"
                        :class="{ selected: store.algorithmId === module.id }"
                        @click="store.loadAlgorithm(module.id)"
                    >
                        {{ module.name }}
                    </button>
                </li>
            </ul>
        </li>
    </ul>
</template>

<style scoped>
.category-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.category + .category {
    border-top: 1px solid var(--color-border-panel);
}

.category-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    width: 100%;
    padding: var(--spacing-2);
    background: none;
    border: none;
    text-align: left;
    font-weight: 500;
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    cursor: pointer;
}

.category-header:hover {
    color: var(--state-active-border);
}

.chevron {
    width: 12px;
    color: var(--color-text-secondary);
}

.category-name {
    flex: 1;
}

.category-count {
    font-size: 12px;
    color: var(--color-text-secondary);
}

.leaf-list {
    list-style: none;
    margin: 0 0 var(--spacing-1) 0;
    padding: 0 0 0 var(--spacing-4);
}

.leaf {
    display: block;
    width: 100%;
    padding: var(--spacing-1) var(--spacing-2);
    background: none;
    border: none;
    text-align: left;
    font-weight: 400;
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    border-radius: var(--radius);
    cursor: pointer;
}

.leaf:hover {
    background: var(--state-idle-bg);
}

.leaf.selected {
    background: var(--state-active-bg);
    color: var(--state-active-text);
}
</style>
