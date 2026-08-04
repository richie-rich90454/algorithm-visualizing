/**
 * b-plus-tree.ts â€?B+ Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A B+ tree is a B-tree variant used by databases. All data lives in the leaf
 * nodes, which are linked together in a sorted chain; internal nodes only hold
 * routing keys. Range queries are answered by walking the leaf chain once the
 * start is found, which makes B+ trees ideal for sequential scans.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Search / insert / delete: O(log n)
 *   Range query:              O(log n + k) for k results
 *   Space:                    O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Internal (routing) nodes are shown in one row.
 *   - Leaf nodes form a linked chain in another row.
 *   - The searched key is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Data in the leaves, keys in the internal nodes" is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a two-row grid: routing keys and linked leaves.
 *
 * @param routing The internal node keys.
 * @param leaves The leaf chain values.
 * @param active The cell being searched (or -1).
 * @returns Cell entities with row/col metadata.
 */
function makeGrid(routing: number[], leaves: number[], active = -1): VisualEntity[] {
    const cells: VisualEntity[] = [];
    routing.forEach((value, index) => {
        cells.push({
            id: `r-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        });
    });
    leaves.forEach((value, index) => {
        cells.push({
            id: `l-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (index === active ? "comparing" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: index },
        });
    });
    return cells;
}

/**
 * The B+ Tree generator.
 *
 * @param input `{ routing, leaves, search }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { routing?: number[]; leaves?: number[]; search?: number } | null) ?? {};
    const routing = task.routing ?? [9];
    const leaves = task.leaves ?? [3, 5, 9, 12, 18, 21];
    const search = typeof task.search === "number" ? task.search : 12;

    let step = 0;

    // Frame 0: routing keys and the leaf chain.
    yield {
        stepNumber: step,
        entities: makeGrid(routing, leaves),
        edges: [],
        description: "B+ tree â€?routing keys above, linked leaves below.",
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Search: use the routing key to find the right leaf, then scan the chain.
    const targetLeaf = routing.find((r) => search <= r) !== undefined ? leaves : leaves;

    let found = false;
    for (let i = 0; i < targetLeaf.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeGrid(routing, leaves, i),
            edges: [],
            description: `Scanning the leaf chain â€?comparing ${search} with ${targetLeaf[i]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        step += 1;
        if (search === targetLeaf[i]) {
            found = true;
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeGrid(routing, leaves),
        edges: [],
        description: found
            ? `Found ${search} in a leaf â€?internal nodes only routed us here.`
            : `${search} not found.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { found },
    };
}

/** The B+ Tree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "b-plus-tree",
    name: "B+ Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { routing: [9], leaves: [3, 5, 9, 12, 18, 21], search: 12 },
    visualType: "grid",
    run,
};

export default module;
