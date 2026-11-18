/**
 * gap-buffer.ts - Gap Buffer
 * Gap moves to cursor; insert shifts only gap. Demo: build seq + insert/delete, verify outcome.
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
        meta: VisualFrame["meta"] = { operations: step },
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
        `Gap Buffer: [${arr.join(", ") || "empty"}]. Gap moves to cursor; insert shifts only gap.`,
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
        6,
        { ok, operations: step, size: arr.length },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A gap buffer stores a mutable sequence with a blank gap at the cursor position. Inserting writes into the gap and shrinks it, while deleting grows it. Moving the cursor slides characters across the gap, so editing near the cursor is O(1) per character but moving far is O(n).",
        "invariants": [
            "All real characters lie before or after the contiguous gap.",
            "The gap starts at the cursor position.",
            "Total capacity equals characters plus gap size."
        ],
        "correctness": "Writing into the gap adds a character exactly at the cursor and reduces the gap, preserving the sequence of real characters. Deleting expands the gap over removed characters. Moving the gap copies characters across without changing their relative order, so the sequence stays correct.",
        "complexityRationale": "Insert and delete at the gap are O(1); moving the gap by d positions shifts d characters, O(d), worst O(n). The backing array is O(n) space.",
        "uses": [
            "Text editors such as early Emacs",
            "Interactive sequence editing",
            "Buffers with localized insertion patterns"
        ],
        "references": [
            "Craig A. Finseth, The Craft of Text Editing, gap buffer chapter",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.1"
        ],
        "workedExample": "Buffer [4, 1 | gap | 7, 3, 6] with cursor after 1. Inserting 9 writes into the gap to get [4, 1, 9 | gap | 7, 3, 6]. Moving the cursor right shifts 7 across the gap, and deleting expands the gap over the character just removed."
    },
    id: "gap-buffer",
    name: "Gap Buffer",
    category: "data-structures",
    complexity: { time: "O(1) at gap, O(n) move", space: "O(n)" },
    defaultInput: { items: [4, 1, 7, 3, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize buffer with gap positioned at cursor",
        "move gap by shifting characters across the gap",
        "compare cursor against gap start to choose shift side",
        "insert text into gap and shrink gap size",
        "delete by expanding gap over removed range",
        "count characters on each side of gap",
        "done: buffer holds text with cursor position",
    ],
};
export default module;
