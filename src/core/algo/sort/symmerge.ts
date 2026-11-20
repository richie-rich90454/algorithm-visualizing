/**
 * symmerge.ts - SymMerge Stable In-Place Merge Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SymMerge is a stable minimum-storage merge attributed to Kim and Kutzner.
 * To merge two adjacent sorted runs, it finds a split by symmetric binary
 * searches, rotates the block of elements that must change sides, and recurses
 * on the two smaller merges. No auxiliary buffer is needed. This module uses
 * SymMerge as the merge step of a bottom-up mergesort.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) comparisons and O(n log^2 n) element moves
 *   Space: O(log n) recursion stack, no merge buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the array; the two runs being merged are highlighted.
 *   - A rotated block is ORANGE and a completed merge is GREEN.
 *   - The final frame marks the whole array GREEN.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Symmetric binary search used by SymMerge to locate a rotation boundary. */
function symSearch<T>(a: T[], l: number, r: number, p: number, leq: (x: T, y: T) => boolean): number {
    while (l < r) {
        const m = Math.floor((l + r) / 2);
        if (leq(a[m] as T, a[p - m] as T)) l = m + 1;
        else r = m;
    }
    return l;
}

/** Left-rotate [lo, hi) so that the block [mid, hi) moves before [lo, mid). */
function rotate<T>(a: T[], lo: number, mid: number, hi: number): void {
    const rev = (x: number, y: number): void => {
        while (x < y) {
            const t = a[x] as T;
            a[x] = a[y] as T;
            a[y] = t;
            x += 1;
            y -= 1;
        }
    };
    rev(lo, mid - 1);
    rev(mid, hi - 1);
    rev(lo, hi - 1);
}

/**
 * Stably merge the adjacent sorted ranges [f1, f2) and [f2, last) in place.
 * Exported so the stability property can be checked independently.
 */
export function symMergeRange<T>(
    a: T[],
    f1: number,
    f2: number,
    last: number,
    leq: (x: T, y: T) => boolean,
): void {
    if (!(f1 < f2 && f2 < last)) return;
    const m = Math.floor((f1 + last) / 2);
    const n = m + f2;
    const start = f2 > m ? symSearch(a, n - last, m, n - 1, leq) : symSearch(a, f1, f2, n - 1, leq);
    const end = n - start;
    rotate(a, start, f2, end);
    symMergeRange(a, f1, start, m, leq);
    symMergeRange(a, m, end, last, leq);
}

function makeBars(a: number[], states: Map<number, EntityState>): VisualEntity[] {
    return a.map((value, index) => ({
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const a: number[] = Array.isArray(input) ? [...(input as number[])] : [5, 2, 9, 1, 7, 3, 8, 4, 6];
    let step = 0;

    const emit = (
        description: string,
        codeLineNumber: number,
        states: Map<number, EntityState> = new Map(),
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities: makeBars(a, states),
            edges: [],
            description,
            codeLineNumber,
            layout: "array",
            meta: { n: a.length, ...meta },
        };
    };

    const leq = (x: number, y: number): boolean => x <= y;
    yield emit("Bottom-up merge sort begins; each merge uses SymMerge.", 0);
    let width = 1;
    while (width < a.length) {
        for (let left = 0; left < a.length; left += 2 * width) {
            const mid = Math.min(left + width, a.length);
            const hi = Math.min(left + 2 * width, a.length);
            if (mid >= hi) continue;
            symMergeRange(a, left, mid, hi, leq);
            const states = new Map<number, EntityState>();
            for (let i = left; i < hi; i += 1) states.set(i, "sorted");
            yield emit(`SymMerge merged [${left}, ${mid}) with [${mid}, ${hi}) using rotations.`, 3, states, { left, mid, hi, width });
        }
        width *= 2;
    }
    const all = new Map<number, EntityState>(a.map((_, idx) => [idx, "sorted" as EntityState]));
    yield emit(`Sorted stably: [${a.join(", ")}].`, 4, all, { sorted: true });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A stable merge must keep equal elements in their original order. SymMerge finds how many elements need to cross from one run to the other by comparing symmetrically from the outside inward, then swaps those two blocks with a rotation and recurses. Because equal pairs are kept in the outer blocks, they are never exchanged, which is what makes the merge stable without a buffer.",
        invariants: [
            "At every recursive step the two ranges to merge are each individually sorted.",
            "The rotation only exchanges a suffix of the left run with a prefix of the right run, preserving the relative order of equal keys.",
            "Every recursive call works on strictly shorter ranges than its caller.",
        ],
        correctness:
            "The symmetric search splits the two runs so that the outer parts are already in final order and only the middle blocks must trade places. The rotation puts the smaller right-run elements before the larger left-run elements; by the sortedness of the inputs, the two resulting sub-merges are independent and each is smaller than the original. Induction gives a fully sorted, stable result.",
        complexityRationale:
            "Each recursive level uses a binary search costing O(log size) comparisons, and the recursion depth is logarithmic, giving O(m log(n/m + 1)) comparisons for runs of sizes m and n. Rotations cost linear moves per level, so a full sort is O(n log n) comparisons and O(n log^2 n) moves with only O(log n) stack space.",
        uses: [
            "Stable sorting where extra memory is unavailable or expensive",
            "The stable sort routine in Go's standard library",
            "Embedded and systems code with strict memory budgets",
        ],
        references: [
            "Pok-Son Kim and Arne Kutzner, Stable Minimum Storage Merging by Symmetric Comparisons, ESA 2004",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.4",
        ],
        workedExample:
            "Merging [0, 2, 5, 9] with [1, 4, 7, 8], two elements cross sides. A rotation changes the layout to [0, 2, 1, 4, 5, 9, 7, 8], and two smaller recursive merges finish it as [0, 1, 2, 4, 5, 7, 8, 9].",
    },
    id: "symmerge",
    name: "SymMerge Sort",
    category: "sorting",
    complexity: { time: "O(n log n) comparisons", space: "O(log n) stack" },
    defaultInput: [5, 2, 9, 1, 7, 3, 8, 4, 6],
    visualType: "array",
    run,
    pseudocode: [
        "start with runs of width one",
        "for each pair of adjacent sorted runs [lo, mid) and [mid, hi)",
        "find the split by symmetric binary comparisons",
        "rotate the block that must change sides",
        "recursively merge the two resulting smaller pairs",
        "double the run width and repeat",
        "done: the whole array is stably sorted",
    ],
};

export default module;
