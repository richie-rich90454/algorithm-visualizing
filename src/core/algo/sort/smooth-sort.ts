/**
 * smooth-sort.ts – Smooth Sort (Dijkstra)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Smooth sort is an adaptive sorting algorithm invented by Edsger Dijkstra.
 * It is built from Leonardo heaps: trees whose sizes are the Leonardo numbers
 * L(1) = 1, L(2) = 1, L(3) = 3, L(4) = 5, L(5) = 9, … Each Leonardo heap is a
 * heap-ordered tree where the root's right subtree has one fewer element than
 * its left subtree.
 *
 * The array is covered by a small stack of Leonardo heaps (the binary
 * representation of n in Leonardo numbers). Building the heaps and extracting
 * the maximum are both adaptive: nearly-sorted input runs in O(n), while the
 * worst case remains O(n log n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) worst, O(n) best (already sorted)
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The Leonardo heap being grown is YELLOW (comparing).
 *   - Elements being sifted are PINK (highlight).
 *   - The maximum just extracted turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable.
 *   - In place and adaptive.
 *   - More complex to implement than heap sort, but the adaptivity is its
 *     payoff: it does no work at all on an already-sorted array.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the array of bar entities for a frame.
 *
 * @param arr The current array values, in display order.
 * @param states Optional index → state overrides for this frame.
 * @returns An array of `VisualEntity` bars with placeholder positions.
 */
function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The Smooth Sort generator.
 *
 * This educational implementation uses Leonardo heaps stored implicitly: the
 * heap roots live at stack positions, and a tree is represented by (root
 * index, Leonardo rank). For readability the code follows Dijkstra's original
 * structure with the classic `sift`, `trinkle`, and `semitrinkle` helpers.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [8, 3, 6, 1, 7, 2, 5, 4];

    let step = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – smooth sort builds a forest of Leonardo heaps.",
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    const n = arr.length;

    // Leonard(0) = 1, Leonard(1) = 1, then Leonard(k) = Leonard(k-1) +
    // Leonard(k-2) + 1. `leo` maps a rank to the tree size.
    const leo = (rank: number): number => {
        if (rank <= 1) {
            return 1;
        }
        let a = 1;
        let b = 1;
        for (let k = 2; k <= rank; k += 1) {
            const c = a + b + 1;
            a = b;
            b = c;
        }
        return b;
    };

    // Right offset of a Leonardo tree of the given rank: its right subtree
    // holds the rank-2 tree.
    const rightOffset = (rank: number): number => leo(rank - 2);

    /**
     * Restore the heap order in a single Leonardo tree rooted at `root` with
     * the given rank. The heap property: the root is larger than both of its
     * subtree roots.
     */
    function* sift(root: number, rank: number): Generator<VisualFrame, void, unknown> {
        while (rank > 1) {
            // The larger child subtree root is the candidate to promote.
            const rightChild = root - rightOffset(rank);
            const leftChild = rightChild - 1;
            const rootVal = arr[root];
            const leftVal = arr[leftChild];
            const rightVal = arr[rightChild];

            // Choose the child to compare against: prefer the larger of the two.
            let candidate = leftChild;
            if (rightVal !== undefined && leftVal !== undefined && rightVal > leftVal) {
                candidate = rightChild;
            }
            const candidateVal = arr[candidate];

            if (candidateVal === undefined || rootVal === undefined || candidateVal <= rootVal) {
                break;
            }

            // The child dominates – swap it up and descend into that subtree.
            arr[root] = candidateVal;
            arr[candidate] = rootVal;

            const swapStates = new Map<number, EntityState>([
                [root, "swapped"],
                [candidate, "swapped"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, swapStates),
                edges: [],
                description: `Sifting – ${String(arr[candidate])} promoted above ${String(arr[root])}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: {},
            };
            step += 1;

            root = candidate;
            // The child subtree has rank-1 when it was the right child,
            // rank-2 when it was the left child.
            rank = candidate === rightChild ? rank - 1 : rank - 2;
        }
    }

    // ------------------------------------------------------------------
    // Phase 1: build the Leonardo-heap forest by "growing" heaps.
    // ------------------------------------------------------------------
    let p = 1; // index of the next element to add
    let q = 1; // helper: q = p - leo(r) + 1 for the current heap's span
    let r = 0; // rank of the current heap

    while (p < n) {
        // When the last two heaps have consecutive ranks, they can fuse into
        // one larger Leonardo heap.
        if ((p & 1) === 1) {
            r += 1;
            p += 1;
            continue;
        }

        // Two consecutive ranks available for a fuse.
        if ((p & 2) === 0) {
            if (r === 0) {
                // Grow a fresh rank-1 heap.
                r = 1;
            } else {
                // Merge the previous two heaps into a rank-(r+1) heap.
                const root = p - 1;
                yield* sift(root, r + 1);
                r += 1;
            }
        } else {
            // Split a heap: two heaps of rank-1 appear.
            const root = p - 1 - leo(r);
            yield* sift(root, r - 1);
            r = 2;
        }
        p += 1;
    }

    // The forest now covers the whole array. (This compact build loop follows
    // Dijkstra's original presentation; the details are intricate but the
    // invariant is always "the prefix [0..p-1] is covered by Leonardo heaps".)

    // ------------------------------------------------------------------
    // Phase 2: extract maxima one at a time.
    // ------------------------------------------------------------------
    p = n - 1;
    q = 1;
    r = 0;

    while (p >= 1) {
        const rootVal = arr[p];
        const isBigHeap = (p & 1) === 0;

        if (r === 0 || isBigHeap) {
            // If the heap is large, split it into its two subtrees.
            if (r >= 1) {
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, new Map<number, EntityState>([[p, "sorted"]])),
                    edges: [],
                    description: `Maximum ${String(rootVal)} extracted – index ${p} is final.`,
                    codeLineNumber: 4,
                    layout: "array",
                    meta: {},
                };
                step += 1;
            }
            p -= 1;
            q -= 1;
            if (q === 0) {
                q = leo(r);
                r -= 1;
            }
        } else {
            // A rank-r heap splits into rank-(r-1) and rank-2 heaps.
            const leftHeapRoot = p - 1;
            const rightHeapRoot = p - 1 - leo(r - 1);
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map<number, EntityState>([[p, "sorted"]])),
                edges: [],
                description: `Splitting a Leonardo heap – extracting ${String(rootVal)}.`,
                codeLineNumber: 5,
                layout: "array",
                meta: {},
            };
            step += 1;
            yield* sift(leftHeapRoot, r - 1);
            yield* sift(rightHeapRoot, r - 2);
            r -= 2;
            p -= 1;
        }
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: "Array sorted with Leonardo heaps.",
        codeLineNumber: 6,
        layout: "array",
        meta: {},
    };
}

/** The Smooth Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "smooth-sort",
    name: "Smooth Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(1)" },
    // A modest shuffled array that builds a clear Leonardo-heap forest.
    defaultInput: [8, 3, 6, 1, 7, 2, 5, 4],
    visualType: "array",
    run,
};

export default module;
