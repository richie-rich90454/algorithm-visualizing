/**
 * heapify-bottom-up.ts - Bottom-Up Heap Construction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Floyd's build-heap converts an arbitrary array into a max-heap in linear
 * time. It starts at the last internal node and sifts each one down in reverse
 * level order. Leaves already satisfy the heap property, and by the time a
 * node is processed both of its child subtrees are heaps, so a single sift-down
 * restores the property at that node.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) - the total sift distance is bounded by a geometric series
 *   Space: O(1) extra - the array is reordered in place
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The array is drawn as bars, one per value.
 *   - The node currently being sifted is YELLOW (comparing).
 *   - A swapped pair is ORANGE (swapped); finalized subtree roots are GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = { values?: number[] };

function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const values = [...(task.values ?? [4, 10, 3, 5, 1, 8, 7])];
    const n = values.length;
    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values),
        edges: [],
        description: `Building a max-heap from [${values.join(", ")}] with the bottom-up method.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons: 0, swaps: 0, heapSize: n },
    };
    step += 1;

    if (n < 2) {
        yield {
            stepNumber: step,
            entities: makeBars(values, n > 0 ? new Map([[0, "sorted"]]) : new Map()),
            edges: [],
            description: "An array with fewer than two elements is already a heap.",
            codeLineNumber: 8,
            layout: "array",
            meta: { comparisons: 0, swaps: 0, heap: [...values] },
        };
        return;
    }

    for (let start = Math.floor(n / 2) - 1; start >= 0; start -= 1) {
        let root = start;
        while (2 * root + 1 < n) {
            let child = 2 * root + 1;
            const states = new Map<number, EntityState>([[root, "comparing"]]);
            if (child + 1 < n) {
                states.set(child + 1, "comparing");
            }
            yield {
                stepNumber: step,
                entities: makeBars(values, states),
                edges: [],
                description: `Sifting from index ${root}: comparing children ${child} and ${Math.min(child + 1, n - 1)}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, swaps, root, child, heapSize: n },
            };
            step += 1;

            if (child + 1 < n && (values[child + 1] as number) > (values[child] as number)) {
                child += 1;
            }
            comparisons += 1;
            if ((values[root] as number) >= (values[child] as number)) {
                break;
            }
            const temp = values[root] as number;
            values[root] = values[child] as number;
            values[child] = temp;
            swaps += 1;
            const swapStates = new Map<number, EntityState>([
                [root, "swapped"],
                [child, "swapped"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(values, swapStates),
                edges: [],
                description: `Swapped indices ${root} and ${child}: ${values[root]} moves down, ${values[child]} moves up.`,
                codeLineNumber: 5,
                layout: "array",
                meta: { comparisons, swaps, root, child, heap: [...values] },
            };
            step += 1;
            root = child;
        }
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) {
        finalStates.set(i, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(values, finalStates),
        edges: [],
        description: `Done: max-heap built with ${comparisons} comparison(s) and ${swaps} swap(s).`,
        codeLineNumber: 8,
        layout: "array",
        meta: { comparisons, swaps, heap: [...values], heapSize: n },
    };
}

/** The Bottom-Up Heap Construction module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Start from the last parent rather than the first. Every leaf is already a valid heap, and when you sift a parent down, its children are heaps too, so one sift is enough. Most nodes near the bottom move only a short distance, which is why the total work is linear instead of quadratic.",
        invariants: [
            "Before processing index i, every subtree rooted below i is already a max-heap.",
            "Sifting swaps a parent with its larger child only when the child is strictly greater.",
            "Every swap keeps the same multiset of values.",
        ],
        correctness:
            "Leaves trivially satisfy the heap property. Inductively, when a node is processed its left and right subtrees are heaps. Sifting down along the path of larger children restores the parent-geq-children condition at each visited node, and because the moved value only descends into a subtree whose root was at least the old parent, the heap property is preserved there. After all internal nodes are processed the whole array is a max-heap.",
        complexityRationale:
            "The number of nodes at height h is at most n divided by 2 to the h plus one, and each sift travels at most h levels. Summing h over all heights gives a geometric series bounded by O(n). Only the input array and a few indices are used, so extra space is O(1).",
        uses: [
            "Building a priority queue from a batch of items in linear time",
            "The first phase of heapsort",
            "Initializing a binary heap in graph algorithms such as Dijkstra",
        ],
        references: [
            "CLRS, Introduction to Algorithms, Chapter 6 on heaps and heapsort",
            "Floyd, Algorithm 245: Treesort, 1964",
        ],
        workedExample:
            'For [4, 10, 3, 5, 1, 8, 7] the last internal node is index 2. Sifting index 2 then index 1 and index 0 yields a max-heap whose root is 10, with each parent at least as large as its children.',
    },
    id: "heapify-bottom-up",
    name: "Bottom-Up Heap Construction",
    category: "data-structures",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { values: [4, 10, 3, 5, 1, 8, 7] },
    visualType: "array",
    run,
    pseudocode: [
        "let n be the array length",
        "for each internal node from floor(n/2) minus one down to zero",
        "set the current node as the sift root",
        "while the root has at least one child",
        "choose the child with the larger value",
        "if the root is at least as large as that child stop",
        "swap the root with the larger child and move down",
        "continue until all internal nodes are processed",
        "done: the array satisfies the max-heap property",
    ],
};

export default module;
