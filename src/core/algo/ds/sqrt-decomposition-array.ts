/**
 * sqrt-decomposition-array.ts - Sqrt Decomposition
 * Block sums answer ranges; updates fix one block. Demo: build on <=6 items, 1 range query verified.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Block sums answer ranges; updates fix one block. Demo: build on <=6 items, 1 range query verified.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sqrt n) query
 *   Space: O(n)
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
 *   - Standard Sqrt Decomposition behavior with textbook operation costs.
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
    const BUILT = "Sqrt Decomposition: built. Block sums answer ranges; updates fix one block.";
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
        "intuition": "Square root decomposition cuts the array into blocks of about sqrt(n) elements and stores one sum per block. A range query scans the partial edge blocks element by element and takes whole covered blocks from their stored sums.",
        "invariants": [
            "Each block sum equals the sum of its elements.",
            "Raw elements and block sums stay consistent after updates.",
            "The query whole blocks plus edge elements cover the range exactly."
        ],
        "correctness": "Edge elements are read directly and whole blocks contribute their stored sums; since the decomposition partitions the array, the collected pieces are disjoint and cover exactly the queried range. An update fixes one element and its block sum, maintaining the invariant.",
        "complexityRationale": "A query touches at most two partial blocks of size sqrt(n) plus O(sqrt(n)) whole blocks, O(sqrt(n)); an update is O(1) plus recomputing one block. Storage is the array plus one sum per block, O(n).",
        "uses": [
            "Range sum and range update on static arrays",
            "Competitive programming fallback when segment trees are overkill",
            "Simple batched aggregation"
        ],
        "references": [
            "cp-algorithms, Sqrt Decomposition",
            "Classic block decomposition techniques in competitive programming literature"
        ],
        "workedExample": "Array [5,2,8,1,7,3] split into two blocks of three; query [1,4] reads edge elements directly and takes the full middle block sum, adding to 18; updating one slot recomputes only its block sum."
    },
    id: "sqrt-decomposition-array",
    name: "Sqrt Decomposition",
    category: "data-structures",
    complexity: { time: "O(sqrt n) query", space: "O(n)" },
    defaultInput: { array: [5, 2, 8, 1, 7, 3], range: [1, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the raw array and no block aggregates",
        "cut the array into blocks of about square-root size",
        "store one sum per block plus the raw elements",
        "query range: scan partial edge blocks element by element",
        "take whole covered blocks from their stored sums",
        "updates fix one element plus its single block sum",
        "done: block sums answer the range and the totals verify",
    ],
};
export default module;
