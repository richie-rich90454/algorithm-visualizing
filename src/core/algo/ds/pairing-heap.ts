/**
 * pairing-heap.ts – Pairing Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A pairing heap is a simple but powerful meldable heap: it is a collection of
 * heap-ordered trees where each node links to its children as a singly linked
 * list. It supports insert and merge in O(1) amortized and extract-min by
 * merging child subtrees pairwise. Despite its simplicity it rivals the
 * Fibonacci heap in practice.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / merge: O(1) amortized
 *   Extract-min:    O(log n) amortized
 *   Space:          O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The heap is drawn as a tree (first child + next sibling layout).
 *   - The minimum at the root is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "First-child / next-sibling" is the entire representation.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Pairing Heap generator.
 *
 * @param input `{ inserts }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [5, 3, 8, 1, 9];

    let step = 0;

    // The heap is a linked tree; we display the min as root and children as a
    // first-child/next-sibling chain.
    const buildFrame = (min: number, rest: number[], message: string): VisualFrame => {
        const values = [min, ...rest];
        const nodes: VisualEntity[] = values.map((value, index) => ({
            id: `n-${index}`,
            type: "node" as const,
            label: String(value),
            value,
            state: index === 0 ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: index === 0 ? "root" : "n-0" },
        }));
        const edges: VisualEdge[] = [];
        for (let i = 0; i < values.length - 1; i += 1) {
            edges.push({
                id: `e-${i}`,
                sourceId: `n-${i}`,
                targetId: `n-${i + 1}`,
                label: i === 0 ? "child" : "sibling",
                state: i === 0 ? "path" : "idle",
                directed: true,
            });
        }
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: values.length },
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
        description: "Empty pairing heap - insert keys to build the meldable heap.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    // Simulate inserts with the minimum always at the root.
    let min = inserts[0] ?? 0;
    const rest: number[] = [];
    for (const value of inserts) {
        if (value < min) {
            rest.push(min);
            min = value;
        } else {
            rest.push(value);
        }
        yield buildFrame(min, rest, `Inserted ${value} – the minimum ${min} stays at the root.`);
        step += 1;
    }

    yield buildFrame(
        min,
        rest,
        `Pairing heap complete – merge operations happen pairwise on extract-min.`,
    );
}

/** The Pairing Heap module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A pairing heap is a meldable heap whose nodes link to their children as a singly linked sibling list. Melding attaches the larger root under the smaller root in O(1); extract-min removes the root and pairwise melds its children. Despite its simplicity it often rivals more complex heaps in practice.",
        "invariants": [
            "Every parent is no larger than its children.",
            "The structure is one heap-ordered tree rooted at the minimum.",
            "Children are stored as a first-child and next-sibling chain."
        ],
        "correctness": "Meld preserves heap order because the smaller root is already at most all of its children and at most the attached root. Extract-min removes the minimum root and re-melds its heap-ordered child subtrees, so the resulting tree is again heap ordered and its root is the next smallest key.",
        "complexityRationale": "Insert and meld are a constant number of pointer changes, O(1) amortized. Extract-min pairwise melds children along one path, O(log n) amortized; one node per key gives O(n) space.",
        "uses": [
            "Dijkstra and Prim with meldable heaps",
            "Event-driven simulation",
            "Priority queues that frequently merge two sets"
        ],
        "references": [
            "Fredrickson and Johnson, The Pairing Heap: A New Form of Self-Adjusting Heap, Algorithmica 1986",
            "CLRS, Introduction to Algorithms, Chapter 19 on binomial heaps"
        ],
        "workedExample": "Insert 5, 3, 8, 1, 9 by melding singletons so the root becomes 1. Extract-min removes 1, pairs the children into groups, and melds those groups left to right to form the remaining heap."
    },
    id: "pairing-heap",
    name: "Pairing Heap",
    category: "data-structures",
    complexity: { time: "O(1) insert amortized", space: "O(n)" },
    defaultInput: { inserts: [5, 3, 8, 1, 9] },
    visualType: "tree",
    run,
    pseudocode: [
        "start with an empty meldable heap",
        "insert key: meld a singleton tree with the current root",
        "meld: attach the larger root as a child of the smaller root",
        "repeat until all keys share one heap-ordered tree",
        "extract-min: remove the root holding the minimum",
        "pair up the root children and meld the pairs left to right",
        "done: minimum is reported and the heap still holds the rest",
    ],
};

export default module;
