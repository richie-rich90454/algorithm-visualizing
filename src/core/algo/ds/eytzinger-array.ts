/**
 * eytzinger-array.ts - Eytzinger Array
 *
 * The Eytzinger layout stores a sorted sequence as an implicit binary search
 * tree in level order. Index 1 is the root, index 0 is unused, and the children
 * of node i live at 2i and 2i+1. A search walks down by doubling the index and
 * adding one comparison result, which is branch-friendly and keeps every step
 * on the same cache line for small trees.
 *
 * Time:  O(log n) per search, O(n log n) to sort before layout
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SearchResult {
    found: number;
    pos: number;
    path: number[];
}

function search(layout: number[], query: number): SearchResult {
    const n = layout.length - 1;
    let i = 1;
    const path: number[] = [];
    while (i <= n) {
        path.push(i);
        i = 2 * i + (query > (layout[i] ?? 0) ? 1 : 0);
    }
    i >>= 1;
    while (i > 0) {
        if (layout[i] === query) return { found: 1, pos: i, path };
        i >>= 1;
    }
    return { found: 0, pos: -1, path };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; queries?: number[] } | null) ?? {};
    const sorted = [...(Array.isArray(task.keys) && task.keys.length > 0 ? task.keys : [1, 3, 5, 7, 9, 11, 13, 15])].sort(
        (a, b) => a - b,
    );
    const queries = Array.isArray(task.queries) ? task.queries : [7, 2, 15, 1];
    const layout: number[] = Array(sorted.length + 1).fill(0);
    let cursor = 0;
    const fill = (pos: number): void => {
        if (pos > sorted.length) return;
        fill(2 * pos);
        layout[pos] = sorted[cursor] ?? 0;
        cursor += 1;
        fill(2 * pos + 1);
    };
    fill(1);
    let step = 0;

    const cells = (hot: number, done: boolean): VisualEntity[] =>
        layout.map((value, index) => ({
            id: `ea-${index}`,
            type: "cell" as const,
            label: index === 0 ? "unused" : String(value),
            value,
            state: (index === hot ? "comparing" : done ? "sorted" : index === 0 ? "idle" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, index, parent: index > 1 ? Math.floor(index / 2) : 0 },
        }));

    yield {
        stepNumber: step,
        entities: cells(-1, false),
        edges: [],
        description: `Sorted keys placed in level order; index 1 is the root and children of i are 2i and 2i+1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { layout: [...layout], keys: sorted.length, hits: [], positions: [] },
    };
    step += 1;

    const hits: number[] = [];
    const positions: number[] = [];
    for (const query of queries) {
        const result = search(layout, query);
        hits.push(result.found);
        positions.push(result.pos);
        for (const index of result.path) {
            yield {
                stepNumber: step,
                entities: cells(index, false),
                edges: [],
                description: `Search ${query}: at index ${index} value ${layout[index]}; jump to child ${2 * index + (query > (layout[index] ?? 0) ? 1 : 0)}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { layout: [...layout], query, index, hits: [...hits], positions: [...positions] },
            };
            step += 1;
        }
        yield {
            stepNumber: step,
            entities: cells(result.found ? result.pos : -1, false),
            edges: [],
            description:
                result.found === 1
                    ? `Query ${query}: matched ${query} at Eytzinger index ${result.pos}.`
                    : `Query ${query}: no ancestor matched, so the key is absent.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { layout: [...layout], query, found: result.found, pos: result.pos, hits: [...hits], positions: [...positions] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(-1, true),
        edges: [],
        description: `All ${queries.length} queries done; ${hits.filter((h) => h === 1).length} hit(s) in the array.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { layout: [...layout], hits, positions, keys: sorted.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An Eytzinger array turns a binary search tree into a plain array with no stored pointers. Put the sorted keys in level order, leave index zero empty, and the children of node i are exactly 2i and 2i+1. A search doubles the current index and adds one bit from a comparison, so each step is a multiply, an add, and one load, which modern CPUs predict and cache well.",
        invariants: [
            "The array at indices 1 through n is the sorted key sequence in level-order tree position.",
            "For node i, all keys in its left subtree at 2i are smaller and all in its right subtree at 2i+1 are larger.",
            "The search path ends below a leaf, and the answer is found by walking that node's ancestors upward.",
        ],
        correctness:
            "Level-order placement gives the binary-search-tree ordering because a parent is emitted before its children and an in-order walk recovers the sorted sequence. The downward loop follows the comparison bit at each node, so it lands just past the leaf where the query belongs; the last valid node is its parent, whose ancestors include the predecessor. Walking upward checks exactly those ancestors, so the key is found if and only if it is present, matching a brute-force membership test.",
        complexityRationale:
            "A level-order array has one slot per key plus an unused zero slot, so space is O(n). Sorting costs O(n log n) once. Each search descends a tree of height log n with constant work per level and then climbs at most log n ancestors, giving O(log n) time.",
        uses: [
            "Static sorted indexes where the key set rarely changes",
            "High-throughput branchless binary search in database and search engines",
            "Embedded systems that want a search tree without pointer storage",
        ],
        references: [
            "Eytzinger, Method of Arranging Information in a Hierarchical Storage System, 1975",
            "Khuong and Morin, Array Layouts for Comparison-Based Searching, 2015",
        ],
        workedExample:
            "Keys 1, 3, 5, 7, 9, 11, 13, 15 are placed by an in-order walk into level-order slots, so index 1 holds 9, index 2 holds 5, and index 3 holds 13. Searching 7 starts at index 1, goes left to 5, then right to index 5 where 7 lives. Searching 2 walks down and then climbs the ancestors without a match, correctly reporting a miss.",
    },
    id: "eytzinger-array",
    name: "Eytzinger Array",
    category: "data-structures",
    complexity: { time: "O(log n) search", space: "O(n)" },
    defaultInput: { keys: [1, 3, 5, 7, 9, 11, 13, 15], queries: [7, 2, 15, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "sort the keys and place them into a level-order array",
        "reserve index zero so children of i are 2i and 2i+1",
        "for each query start at the root index one",
        "jump to the left or right child using one comparison",
        "stop after walking past the last array index",
        "halve the index to return to the last valid node",
        "walk up ancestors until the key matches or the root passes",
        "report a hit or a miss for every query",
    ],
};

export default module;
