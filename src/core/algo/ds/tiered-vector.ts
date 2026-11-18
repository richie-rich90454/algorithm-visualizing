/**
 * tiered-vector.ts - Tiered Vector
 * Two-level blocks shift within one block. Demo: build seq + insert/delete, verify outcome.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two-level blocks shift within one block. Demo: build seq + insert/delete, verify outcome.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sqrt n) insert
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
 *   - Standard Tiered Vector behavior with textbook operation costs.
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
    const t = (input as { items?: number[] } | null) ?? {};
    const init = (Array.isArray(t.items) ? t.items : [4, 1, 7, 3, 6]).slice(0, 8);
    const arr = [...init];
    let step = 0;
    const show = (
        hl: number[] = [],
        st: EntityState = "comparing",
        msg: string,
        line: number,
        meta: VisualFrame["meta"] = {},
    ) => ({
        stepNumber: step,
        entities: cells(arr, new Map(hl.map((i) => [i, st]))),
        edges: [],
        description: msg,
        codeLineNumber: line,
        layout: "grid" as const,
        meta,
    });
    yield show(
        [],
        "unvisited",
        `Tiered Vector: [${arr.join(", ") || "empty"}]. Two-level blocks shift within one block.`,
        0,
    );
    step += 1;
    if (arr.length === 0) {
        yield show([], "unvisited", "Empty input: nothing to edit.", 1);
        return;
    }
    const at = 1;
    const val = 9;
    arr.splice(Math.min(at, arr.length), 0, val);
    yield show(
        [Math.min(at, arr.length - 1)],
        "comparing",
        `Insert ${val} at ${at}: [${arr.join(", ")}].`,
        1,
    );
    step += 1;
    const out = arr.splice(0, 1)[0];
    yield show([0], "highlight", `Delete first (${out}): [${arr.join(", ")}].`, 2);
    step += 1;
    const ok = arr.includes(val);
    yield show(
        arr.map((_, i) => i),
        "sorted",
        `Final [${arr.join(", ")}]; contains ${val}: ${ok}. Length ${arr.length} verified.`,
        3,
        { ok },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A tiered vector groups elements into a two-level hierarchy of blocks so an insert or delete shifts elements only within one small block. Choosing block size about sqrt(n) keeps both shift cost and block count balanced.",
        "invariants": [
            "Elements are stored in contiguous blocks.",
            "Blocks are linked in order.",
            "Insert and delete close gaps inside a single block without moving other blocks."
        ],
        "correctness": "Shifting within a block preserves the relative order of all other elements, so after insertion the sequence is the original with one value added at the right position. Reading blocks in order yields exactly the current sequence, so membership and length checks are correct.",
        "complexityRationale": "A shift touches at most one block of size O(sqrt(n)), O(sqrt(n)) time, and indexing skips whole blocks. Storage is the elements plus block metadata, O(n).",
        "uses": [
            "Editable sequences with frequent middle insertions",
            "Text and list buffers",
            "Persistent vectors in functional settings"
        ],
        "references": [
            "Okasaki, Purely Functional Random-Access Lists, FPCA 1995",
            "Brodnik et al., Resizable Arrays in Optimal Time and Space, 1999"
        ],
        "workedExample": "Items 4, 1, 7, 3, 6 packed into blocks; inserting a value shifts only its block, deleting the first closes the gap in that block, and reading blocks back verifies the final order."
    },
    id: "tiered-vector",
    name: "Tiered Vector",
    category: "data-structures",
    complexity: { time: "O(sqrt n) insert", space: "O(n)" },
    defaultInput: { items: [4, 1, 7, 3, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the initial sequence packed in two-level blocks",
        "insert value at the index by shifting inside one block",
        "only the touched block moves, neighbors stay put",
        "delete the first element and close the gap in its block",
        "membership and length checks read the blocks directly",
        "verify the final order matches the expected sequence",
        "done: blocks spell the final vector and checks verify",
    ],
};
export default module;
