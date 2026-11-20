/**
 * categories.ts – Human-readable labels for every algorithm category.
 *
 * Used by the sidebar tree, deep-link metadata, and the learning layer so a
 * category is named the same way everywhere in the application.
 */

import type { AlgorithmCategory } from "@/types";

export const CATEGORY_LABELS: Record<AlgorithmCategory, string> = {
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
    "ml-ai": "Machine Learning & AI",
    "cryptography-security": "Cryptography & Security",
    "parallel-distributed": "Parallel & Distributed Systems",
    "numerical-optimization": "Numerical Methods & Optimization",
    quantum: "Quantum Algorithms",
    "statistics-probability": "Statistics & Probability",
    "production-systems": "Production Systems",
};

/** @returns A display label for a category, falling back to its raw id. */
export function categoryLabel(category: AlgorithmCategory): string {
    return CATEGORY_LABELS[category] ?? category;
}
