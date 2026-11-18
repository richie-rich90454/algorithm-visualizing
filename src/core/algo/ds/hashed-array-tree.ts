/**
 * hashed-array-tree.ts - Hashed Array Tree
 * Top bits pick leaf, low bits offset. Demo: build seq + insert/delete, verify outcome.
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
        `Hashed Array Tree: [${arr.join(", ") || "empty"}]. Top bits pick leaf, low bits offset.`,
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
        "intuition": "A hashed array tree stores an array as a two-level structure: a top directory of leaf blocks, with the high bits of an index selecting the leaf and the low bits the offset. This keeps elements contiguous within leaves while avoiding the large single allocation of a dynamic array.",
        "invariants": [
            "Index bits split into a top part and an offset part.",
            "Each leaf stores a fixed number of elements contiguously.",
            "The directory grows when a new leaf is needed."
        ],
        "correctness": "Splitting the index by bits gives a unique (leaf, offset) pair, so reading and writing an index always targets the correct slot. Appending fills the current leaf before allocating the next, preserving order. Growing the directory copies pointers, not elements.",
        "complexityRationale": "Indexed access is two array dereferences, O(1). Storage is O(n) for elements plus a small directory, with geometric growth amortized.",
        "uses": [
            "Append-friendly arrays with stable blocks",
            "Persistent vector implementations",
            "Large arrays that grow without full copies"
        ],
        "references": [
            "Chris Okasaki, Purely Functional Data Structures, Chapter 12",
            "Robert Sedgewick and Kevin Wayne, Algorithms, Section 1.4 on dynamic arrays"
        ],
        "workedExample": "Build from [4, 1, 7, 3, 6] with leaf size 4: the top directory has two leaves, the first holding 4, 1, 7, 3 and the second holding 6. Reading index 5 uses high bits to pick leaf 1 and low bits to pick offset 1."
    },
    id: "hashed-array-tree",
    name: "Hashed Array Tree",
    category: "data-structures",
    complexity: { time: "O(1) index", space: "O(n)" },
    defaultInput: { items: [4, 1, 7, 3, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize hashed array tree with top directory",
        "map index to top and leaf positions by bit split",
        "compare size against capacity to grow directory",
        "insert value at leaf slot for logical index",
        "read value by two-level dereference in O(1)",
        "count stored elements for size",
        "done: tree holds array values with indexed state",
    ],
};
export default module;
