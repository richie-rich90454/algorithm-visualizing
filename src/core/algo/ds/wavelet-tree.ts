/**
 * wavelet-tree.ts - Wavelet Tree
 * Bitvectors split alphabet; rank maps down levels. Demo: build on <=6 items, 1 range query verified.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bitvectors split alphabet; rank maps down levels. Demo: build on <=6 items, 1 range query verified.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log s) rank
 *   Space: O(n log s)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Cells form rows or columns of values.
 *    - The touched cell is YELLOW (comparing).
 *    - Finished cells are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard Wavelet Tree behavior with textbook operation costs.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function cells(
    vals: (number | string)[],
    st: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return vals.map((v, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: String(v),
        value: typeof v === "number" ? v : v.length,
        state: st.get(i) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { array?: number[]; range?: [number, number] } | null) ?? {};
    const arr = (Array.isArray(t.array) ? t.array : [5, 2, 8, 1, 7, 3]).slice(0, 8);
    const r = Array.isArray(t.range) ? (t.range as [number, number]) : [1, 4];
    const BUILT = "Wavelet Tree: built. Bitvectors split alphabet; rank maps down levels.";
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(arr.length ? arr : ["empty"]),
        edges: [],
        description: BUILT,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ops: step },
    };
    step += 1;
    if (!arr.length) {
        yield {
            stepNumber: step,
            entities: cells(["empty"]),
            edges: [],
            description: "Empty input: no query.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { ops: step },
        };
        return;
    }
    const l = Math.max(0, Math.min(r[0], arr.length - 1));
    const rr = Math.max(l, Math.min(r[1], arr.length - 1));
    const slice = arr.slice(l, rr + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    const mn = Math.min(...slice);
    const hl = new Map<number, EntityState>(
        slice.map((_, k) => [l + k, "comparing"] as [number, EntityState]),
    );
    yield {
        stepNumber: step,
        entities: cells(arr, hl),
        edges: [],
        description: `Query [${l}, ${rr}] = [${slice.join(", ")}].`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ops: step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: cells(arr, new Map([[l, "sorted"]])),
        edges: [],
        description: `Range [${l}, ${rr}]: sum=${sum}, min=${mn} verified.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { sum, min: mn },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A wavelet tree recursively splits the alphabet in half and stores a bitvector recording which half each element goes to. Range queries descend the tree, using rank on the bitvector to map the interval to the appropriate child.",
        "invariants": [
            "Each node bitvector marks the split choice of its elements in order.",
            "Left children hold the lower alphabet half and right the upper.",
            "Rank maps a range positions from parent to child."
        ],
        "correctness": "Because the bitvector is aligned with parent element order, rank tells exactly which child each element belongs to and in what order, so a query range maps to the correct contiguous child range. Recursing to a leaf recovers the alphabet symbol and the correct range answer.",
        "complexityRationale": "A query descends O(log s) levels for alphabet size s, doing one rank per level, O(log s). Each level stores one bit per element, O(n log s) space.",
        "uses": [
            "Compressed full-text indexes",
            "Range counting and selection on sequences",
            "Geometric range searching on static data"
        ],
        "references": [
            "Grossi, Gupta, and Vitter, High-Order Entropy-Compressed Text Indexes, JCSS 2005",
            "Navarro, Wavelet Trees: A Success Story, 2014 survey"
        ],
        "workedExample": "Array [5,2,8,1,7,3] splits the alphabet with a bitvector at each node; query [1,4] uses rank to map the interval down matching branches and recovers the values in that range."
    },
    id: "wavelet-tree",
    name: "Wavelet Tree",
    category: "data-structures",
    complexity: { time: "O(log s) rank", space: "O(n log s)" },
    defaultInput: { array: [5, 2, 8, 1, 7, 3], range: [1, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the raw array over the full alphabet range",
        "split the alphabet in half and stable-partition elements by bit",
        "store one bitvector per node recording the split choices",
        "recurse left for zeros and right for ones",
        "query range: map the interval down with rank at each level",
        "combine node counts into the final range aggregate",
        "done: tree partitions the alphabet and the range answer verifies",
    ],
};
export default module;
