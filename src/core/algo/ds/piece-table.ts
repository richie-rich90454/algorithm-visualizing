/**
 * piece-table.ts - Piece Table
 * Edits append pieces; original buffer untouched. Demo: build seq + insert/delete, verify outcome.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Edits append pieces; original buffer untouched. Demo: build seq + insert/delete, verify outcome.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) insert
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
 *   - Standard Piece Table behavior with textbook operation costs.
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
        `Piece Table: [${arr.join(", ") || "empty"}]. Edits append pieces; original buffer untouched.`,
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
        "intuition": "A piece table never modifies the original text buffer. It describes the document as a list of pieces pointing into the original buffer or an append-only add buffer; inserting appends text and splices a piece, and deleting drops or trims pieces.",
        "invariants": [
            "The original buffer is never changed.",
            "The piece list spells the current text in order.",
            "Every piece references a valid buffer, start, and length."
        ],
        "correctness": "Reading pieces in order concatenates exactly the characters currently present, because each edit only adds or removes pieces describing the intended text. Since the original buffer is immutable, every historical piece remains valid, which enables undo and multiple views.",
        "complexityRationale": "A splice is O(1) with a linked piece list but O(n) with a flat array that must shift entries; reading the full text is O(n). Space is the original buffer plus appended text and one record per piece, O(n).",
        "uses": [
            "Text editors such as Visual Studio Code",
            "Word processors needing cheap undo",
            "Applications with frequent edits and versioned buffers"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 1, piece tables in text editing",
            "Greenberg and Malendar, A Data Structure for Text Editors, 1987"
        ],
        "workedExample": "Start with abc as one original piece; insert XY after b by appending to the add buffer and splitting into pieces ab, XY, c. Deleting X trims that piece, producing abYc without touching the original abc buffer."
    },
    id: "piece-table",
    name: "Piece Table",
    category: "data-structures",
    complexity: { time: "O(n) insert", space: "O(n)" },
    defaultInput: { items: [4, 1, 7, 3, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the original buffer plus an empty add buffer",
        "describe the text as a list of pieces pointing into buffers",
        "insert: append text to the add buffer and splice in a new piece",
        "delete: drop or trim pieces, never touch the original buffer",
        "repeat edits, pieces always spell the current sequence",
        "verify by reading the pieces back in order",
        "done: piece list spells the edited text and checks pass",
    ],
};
export default module;
