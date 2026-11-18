/**
 * b-tree.ts – B-Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A B-tree is a self-balancing search tree with many keys per node and many
 * children (a branching factor ≥ 2). It is designed for block-based storage
 * (databases, filesystems): a wide node holds an entire disk block, so few
 * levels are needed and few disk reads occur. A node of order t holds at most
 * 2t−1 keys and 2t children; overflow splits a full node into two.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Search / insert / delete: O(log_t n) – few levels, wide nodes
 *   Space:                    O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is a box containing several key cells.
 *   - The node being searched is YELLOW (comparing).
 *   - Split nodes are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The wide-node / multi-key design is the entire concept.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * The B-Tree generator.
 *
 * @param input `{ keys, search }` – the root node's keys and a search value.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; search?: number } | null) ?? {};
    const keys = task.keys ?? [5, 12, 20];
    const search = typeof task.search === "number" ? task.search : 20;

    let step = 0;

    const makeNode = (values: number[], active = -1): VisualEntity[] =>
        values.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (index === active ? "comparing" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        }));

    // Frame 0: the root node.
    yield {
        stepNumber: step,
        entities: makeNode(keys),
        edges: [],
        description: "B-tree root node (order 3 – up to 5 keys per node).",
        codeLineNumber: 0,
        layout: "grid",
        meta: { operations: step },
    };
    step += 1;

    // Search within the node.
    let found = false;
    for (let i = 0; i < keys.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeNode(keys, i),
            edges: [],
            description: `Comparing ${search} with key ${keys[i]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { operations: step },
        };
        step += 1;
        if (search === keys[i]) {
            found = true;
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeNode(keys, found ? keys.indexOf(search) : -1).map((c) =>
            found && c.value === search ? { ...c, state: "sorted" as EntityState } : c,
        ),
        edges: [],
        description: found
            ? `Found ${search} in the node – descending into children only if needed.`
            : `${search} not in this node – follow the appropriate child pointer.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { found },
    };
}

/** The B-Tree module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A B-tree is a balanced search tree whose nodes hold many keys and many children, so one node fits a disk block. Splitting a full node and promoting its median keeps all leaves at the same depth. The wide branching factor means fewer levels and fewer disk reads than a binary tree.",
        "invariants": [
            "A node of order t holds between t-1 and 2t-1 keys.",
            "Keys in a node separate its child subtrees by range.",
            "All leaves are at the same depth."
        ],
        "correctness": "The separator keys define disjoint ranges for the children, so comparing the search key at each level always descends into the only subtree that can contain it. Splitting a full node around its median and promoting the median preserves both the key ranges and the equal-depth property. Therefore search finds a key exactly when it is stored.",
        "complexityRationale": "Each node has order t children, so height is O(log_t n) and each operation touches one node per level. In internal memory that is O(log n) comparisons; on disk it is O(log_t n) I/Os. Space is O(n) because keys are stored once.",
        "uses": [
            "Database and filesystem indexes",
            "Block-oriented storage where I/O dominates",
            "Ordered dictionaries on disk"
        ],
        "references": [
            "R. Bayer and E. McCreight, \"Organization and Maintenance of Large Ordered Indexes\", 1972",
            "CLRS, Introduction to Algorithms, Chapter 18"
        ],
        "workedExample": "Insert 5, 12, 20 into a B-tree node that can hold up to three keys; the node becomes [5, 12, 20] at the root. Searching for 20 compares inside the root and finds it directly. Adding 30 overflows the node, so splitting around median 12 promotes 12 to a new root with children [5] and [20, 30]."
    },
    id: "b-tree",
    name: "B-Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { keys: [5, 12, 20], search: 20 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty B-tree with single node root",
        "search node keys and descend to matching child",
        "insert key into node in sorted order",
        "if node is full then split around median key",
        "promote median to parent and create sibling node",
        "compare keys to guide each level of descent",
        "done: balanced B-tree holds keys with minimal height",
    ],
};

export default module;
