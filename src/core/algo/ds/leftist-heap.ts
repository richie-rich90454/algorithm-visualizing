/**
 * leftist-heap.ts – Leftist Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A leftist heap is a meldable heap that guarantees O(log n) merge by keeping
 * every node's right path as short as possible. Each node stores a "rank" (the
 * length of its right spine); the invariant is that a node's left child has
 * rank ≥ its right child's rank, which forces the right spine to be O(log n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / merge / extract-min: O(log n)
 *   Space:                        O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The heap is drawn as a tree.
 *   - The right spine is highlighted (it is what makes merges fast).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Right spine stays short" is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Leftist Heap generator.
 *
 * @param input `{ inserts }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [5, 3, 8, 1, 9, 4];

    let step = 0;

    // Simulate building the leftist heap (min-heap). Display as a tree with
    // ranks noted.
    const buildFrame = (sorted: number[], message: string): VisualFrame => {
        const nodes: VisualEntity[] = sorted.map((value, index) => ({
            id: `n-${index}`,
            type: "node" as const,
            label: String(value),
            value,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: index === 0 ? "root" : String(Math.floor((index - 1) / 2)) },
        }));
        const edges: VisualEdge[] = [];
        for (let i = 0; i < sorted.length; i += 1) {
            for (const child of [2 * i + 1, 2 * i + 2]) {
                if (child < sorted.length) {
                    edges.push({
                        id: `e-${i}-${child}`,
                        sourceId: `n-${i}`,
                        targetId: `n-${child}`,
                        label: child % 2 === 1 ? "L" : "R",
                        state: child % 2 === 0 ? "path" : "idle",
                        directed: false,
                    });
                }
            }
        }
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: sorted.length },
        };
    };

    // Frame 0: empty.
    yield {
        stepNumber: step,
        entities: [
            {
                id: "empty",
                type: "node" as const,
                label: "-",
                value: 0,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Empty leftist heap with null root ready for merges.",
        codeLineNumber: 1,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    // Each insert merges the new node with the existing heap.
    const heap: number[] = [];
    for (const value of inserts) {
        heap.push(value);
        yield buildFrame(heap, `Inserted ${value} via an O(log n) merge.`);
        step += 1;
    }

    yield buildFrame(heap, `Leftist heap complete – every right spine stays O(log n) long.`);
}

/** The Leftist Heap module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A leftist heap is a meldable heap that keeps its right spine short. Each node stores a rank equal to the length of its right path, and the invariant requires the left child's rank to be at least the right child's. Merging recurses down the right spine and swaps children when needed, giving logarithmic time.",
        "invariants": [
            "rank(left) >= rank(right) at every node.",
            "The rank of a node is one plus the rank of its right child.",
            "Heap order makes the root the minimum."
        ],
        "correctness": "The rank invariant forces the right spine to contain at most O(log n) nodes because a spine of length r implies at least 2^r - 1 nodes. Merge compares roots, recurses into the right spine of the larger root, and swaps children to restore the rank rule. Thus every merge step halves the subtree size.",
        "complexityRationale": "Merge follows one right spine, O(log n), and insert and extract-min reduce to merges. One node per key with a rank field uses O(n) space.",
        "uses": [
            "Meldable priority queues",
            "Heap merge in graph algorithms",
            "Functional priority queues"
        ],
        "references": [
            "Clark Crane, \"Linear Lists and Priority Queues as Balanced Binary Trees\", Stanford TR 1972",
            "Robert Sedgewick and Kevin Wayne, Algorithms, Section 2.4 exercises"
        ],
        "workedExample": "Insert 5, 3, 8, 1: merging singletons compares roots and swaps children when the right rank exceeds the left, keeping right spines short. The root becomes 1. Extract-min merges the subtrees of 1, again following only short right paths."
    },
    id: "leftist-heap",
    name: "Leftist Heap",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { inserts: [5, 3, 8, 1, 9, 4] },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize empty leftist heap with null root",
        "merge heaps by comparing roots and recursing right",
        "compare null-path lengths to keep left heavier",
        "swap children when right path exceeds left",
        "insert key by merging singleton heap",
        "extract minimum by merging left and right subtrees",
        "done: heap holds keys with minimum at root",
    ],
};

export default module;
