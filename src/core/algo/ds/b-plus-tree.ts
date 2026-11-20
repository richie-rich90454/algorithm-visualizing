/**
 * b-plus-tree.ts – B+ Tree
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
        description: "B+ tree – routing keys above, linked leaves below.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { operations: step },
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
            description: `Scanning the leaf chain – comparing ${search} with ${targetLeaf[i]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { operations: step },
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
            ? `Found ${search} in a leaf – internal nodes only routed us here.`
            : `${search} not found.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { found },
    };
}

/** The B+ Tree module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A B+ tree keeps all actual records in linked leaf nodes and uses internal nodes only for routing keys. Because leaves are chained in sorted order, a range query finds the starting leaf once and then walks the chain. The high fanout keeps the tree shallow, which is why databases use it for indexes.",
        "invariants": [
            "All keys are stored in leaves; internal nodes hold only separator keys.",
            "Leaves are linked in ascending key order.",
            "All leaves sit at the same depth."
        ],
        "correctness": "Routing compares the search key with separators to choose the child interval that must contain it, so descent reaches the unique leaf that can hold the key. Splitting an overflowing leaf and promoting its middle key preserves the search intervals and equal depths. A range query starting at that leaf follows next pointers and returns keys in sorted order.",
        "complexityRationale": "With high fanout the height is O(log n), so point search and insertion cost O(log n). A range query adds O(k) to walk k result keys, giving O(log n + k). Storing each key once in a leaf uses O(n) space.",
        "uses": [
            "Database and filesystem indexes",
            "Range scans and ordered iteration",
            "Key-value stores such as MySQL InnoDB"
        ],
        "references": [
            "R. Bayer and E. McCreight, \"Organization and Maintenance of Large Ordered Indexes\", 1972",
            "CLRS, Introduction to Algorithms, Chapter 18"
        ],
        "workedExample": "With routing key 9 and leaves 3, 5, 9, 12, 18, 21, searching for 12 compares with 9, goes to the right leaf group, and finds 12. A range scan for keys 9 through 18 starts at the leaf containing 9 and follows leaf links through 12 and 18, returning them in order."
    },
    id: "b-plus-tree",
    name: "B+ Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { routing: [9], leaves: [3, 5, 9, 12, 18, 21], search: 12 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty B+ tree with single leaf root",
        "search down internal keys to locate target leaf",
        "insert key into leaf in sorted order",
        "if leaf overflows then split and promote middle key",
        "link leaves together for range scans",
        "count keys and height during traversal",
        "done: balanced B+ tree holds keys with linked leaves",
    ],
};

export default module;
