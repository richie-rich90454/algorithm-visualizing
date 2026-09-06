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
 * Visualization mapping
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

    // Leonardo numbers L(0) = L(1) = 1, L(k) = L(k-1) + L(k-2) + 1.
    // A Leonardo heap of order k holds L(k) elements; its left subtree has
    // order k-1 and its right subtree order k-2.
    const LP = [
        1, 1, 3, 5, 9, 15, 25, 41, 67, 109, 177, 287, 465, 753, 1219, 1973, 3193, 5167, 8361, 13529,
        21891, 35421, 57313, 92735, 150049, 242785, 392835, 635621, 1028457, 1664079, 2692537,
        4356617, 7049155, 11405773, 18454929, 29860703, 48315633, 78176337, 126491971, 204668309,
        331160281, 535828591, 866988873,
    ];

    // Trailing zero count for a 32-bit bitmap (used to walk heap-size bits).
    const trailingZeros = (x: number): number => {
        let t = 0;
        while (t < 32 && (x & 1) === 0) {
            x >>>= 1;
            t += 1;
        }
        return t;
    };

    const swapYield = function* (
        a: number,
        b: number,
        message: string,
        codeLine: number,
    ): Generator<VisualFrame, void, unknown> {
        const tmp = arr[a] as number;
        arr[a] = arr[b] as number;
        arr[b] = tmp;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [a, "swapped"],
                    [b, "swapped"],
                ]),
            ),
            edges: [],
            description: message,
            codeLineNumber: codeLine,
            layout: "array",
            meta: {},
        };
        step += 1;
    };

    /**
     * Restore heap order inside the Leonardo tree of order `pshift` rooted at
     * `head`. Only descendants move; the roots of earlier trees are untouched.
     */
    function* sift(head: number, pshift: number): Generator<VisualFrame, void, unknown> {
        for (;;) {
            if (pshift <= 1) {
                break;
            }
            const rt = head - 1;
            const lf = head - 1 - (LP[pshift - 2] ?? 0);
            const headVal = arr[head];
            const lfVal = arr[lf];
            const rtVal = arr[rt];
            if (headVal === undefined || lfVal === undefined || rtVal === undefined) {
                break;
            }
            const goLeft = lfVal >= rtVal;
            const child = goLeft ? lf : rt;
            const childVal = goLeft ? lfVal : rtVal;
            if (headVal >= childVal) {
                break;
            }
            yield* swapYield(
                head,
                child,
                `Sifting ${String(headVal)} down – parent must exceed its children.`,
                2,
            );
            head = child;
            pshift -= goLeft ? 1 : 2;
        }
    }

    /**
     * Dijkstra's trinkle: fix a root that may violate the heap property with
     * its children *and* with the roots of the trees to its left (its
     * "stepsons"), then sift within its own tree.
     */
    function* trinkle(
        p: number,
        pshift: number,
        head: number,
        isTrusty: boolean,
    ): Generator<VisualFrame, void, unknown> {
        const val = arr[head];
        if (val === undefined) {
            return;
        }
        while (p !== 1) {
            const stepson = head - (LP[pshift] ?? 0);
            const stepsonVal = arr[stepson];
            if (stepsonVal === undefined || stepsonVal <= val) {
                break;
            }
            if (!isTrusty && pshift > 1) {
                const rt = head - 1;
                const lf = head - 1 - (LP[pshift - 2] ?? 0);
                const lfVal = arr[lf];
                const rtVal = arr[rt];
                if (lfVal === undefined || rtVal === undefined) {
                    break;
                }
                if (rtVal >= stepsonVal || lfVal >= stepsonVal) {
                    break;
                }
            }
            yield* swapYield(
                head,
                stepson,
                `Trinkling – ${String(stepsonVal)} reclaims the root.`,
                2,
            );
            head = stepson;
            const trail = trailingZeros(p & ~1);
            p >>>= trail;
            pshift += trail;
            isTrusty = false;
        }
        if (!isTrusty) {
            yield* sift(head, pshift);
        }
    }

    /**
     * Semitrinkle: the tree at `head` is already a heap; only its root may be
     * smaller than the previous tree's root, so compare the two roots and
     * trinkle on a swap.
     */
    function* semitrinkle(
        p: number,
        pshift: number,
        head: number,
    ): Generator<VisualFrame, void, unknown> {
        const prev = head - (LP[pshift] ?? 0);
        const headVal = arr[head];
        const prevVal = arr[prev];
        if (headVal === undefined || prevVal === undefined) {
            return;
        }
        if (prevVal >= headVal) {
            yield* swapYield(
                head,
                prev,
                `Semitrinkle – ${String(prevVal)} outranks ${String(headVal)}.`,
                2,
            );
            yield* trinkle(p, pshift, prev, false);
        }
    }

    // ------------------------------------------------------------------
    // Phase 1: grow a forest of Leonardo heaps over the prefix.
    // `p` is a bitmap of the heap sizes; `pshift` is the order of the
    // rightmost heap; `head` is the element being incorporated.
    // ------------------------------------------------------------------
    let p = 1;
    let pshift = 1;
    let head = 0;
    const hi = n - 1;

    while (head < hi) {
        if ((p & 3) === 3) {
            // The last two heaps have consecutive orders – fuse them with the
            // new element into one larger heap.
            yield* sift(head, pshift);
            p >>>= 2;
            pshift += 2;
        } else {
            // Start a new single-element heap; sift it when it will merge
            // later, trinkle it when this is its final shape.
            if ((LP[pshift - 1] ?? 0) >= hi - head) {
                yield* trinkle(p, pshift, head, false);
            } else {
                yield* sift(head, pshift);
            }
            if (pshift === 1) {
                p <<= 1;
                pshift -= 1;
            } else {
                p <<= pshift - 1;
                pshift = 1;
            }
        }
        p |= 1;
        head += 1;
    }

    if (n > 0) {
        yield* trinkle(p, pshift, head, false);
    }

    // ------------------------------------------------------------------
    // Phase 2: shrink the forest, depositing each maximum at the end.
    // Roots ascend left to right, so index `head` always holds the maximum
    // of the remaining prefix when the iteration starts.
    // ------------------------------------------------------------------
    while (pshift !== 1 || p !== 1) {
        const rootVal = arr[head];
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[head, "sorted"]])),
            edges: [],
            description: `Maximum ${String(rootVal)} extracted – index ${head} is final.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {},
        };
        step += 1;

        if (pshift <= 1) {
            // Single-element heap – just drop it from the forest.
            const trail = trailingZeros(p & ~1);
            p >>>= trail;
            pshift += trail;
        } else {
            // Split the heap into its rank-(pshift-1) and rank-(pshift-2)
            // subtrees and restore both new roots.
            p <<= 2;
            p ^= 7;
            pshift -= 2;
            yield* trinkle(p >>> 1, pshift + 1, head - (LP[pshift] ?? 0) - 1, true);
            yield* trinkle(p, pshift, head - 1, true);
        }
        head -= 1;
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
