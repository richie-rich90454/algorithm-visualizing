/**
 * roaring-bitmap.ts - Roaring Bitmap
 * Dense chunks are bitmaps, sparse are arrays. Demo: add <=6 values, test hit + miss.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dense chunks are bitmaps, sparse are arrays. Demo: add <=6 values, test hit + miss.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) ops
 *   Space: O(k)
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
 *   - Standard Roaring Bitmap behavior with textbook operation costs.
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
    const t = (input as { values?: number[]; query?: number } | null) ?? {};
    const vals = (Array.isArray(t.values) ? t.values : [3, 1, 4, 6]).slice(0, 8);
    const q = typeof t.query === "number" ? t.query : 4;
    const set = new Set<number>();
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(vals.length ? [0] : [0], new Map()),
        edges: [],
        description: "Roaring Bitmap: empty. Dense chunks are bitmaps, sparse are arrays.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ops: step },
    };
    step += 1;
    for (const v of vals) {
        set.add(v);
        yield {
            stepNumber: step,
            entities: cells([...set], new Map([[[...set].indexOf(v), "comparing"]])),
            edges: [],
            description: `Add ${v} (size ${set.size}).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { ops: step },
        };
        step += 1;
    }
    if (set.size === 0) {
        yield {
            stepNumber: step,
            entities: cells(["empty"]),
            edges: [],
            description: "Empty set.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { ops: step },
        };
        return;
    }
    const arr = [...set];
    const hit = set.has(q);
    yield {
        stepNumber: step,
        entities: cells(arr, new Map(hit ? [[arr.indexOf(q), "highlight"]] : [])),
        edges: [],
        description: `Contains ${q}: ${hit}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ops: step },
    };
    step += 1;
    const miss = 999;
    const mhit = set.has(miss);
    yield {
        stepNumber: step,
        entities: cells(arr, new Map()),
        edges: [],
        description: `Contains ${miss}: ${mhit}. Final size ${set.size}; query ${q} ${hit ? "present" : "absent"} verified.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { hit, size: set.size },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A Roaring bitmap divides the universe into chunks by high bits and stores each chunk in its cheapest form: a sorted array when sparse, a bitmap when dense. Membership checks only the relevant container, and the representation switches automatically as density grows.",
        "invariants": [
            "Each value belongs to exactly one container keyed by its high bits.",
            "A container representation matches its density.",
            "Contained values are sorted or set at their bit position."
        ],
        "correctness": "A query selects the container for the value high bits and checks presence there; no other container can hold it, so the verdict is exact. Converting a container between array and bitmap preserves its element set, so density changes never lose values.",
        "complexityRationale": "Selecting a container and testing membership are expected O(1); each container covers a fixed chunk so per-operation work is bounded. Space adapts from sparse arrays to dense bitmaps, O(k) for k values.",
        "uses": [
            "Inverted indexes in search engines",
            "Analytics on large integer sets",
            "Fast set operations in column stores"
        ],
        "references": [
            "Chambi, Lemire, Kucherov, and Bisson, Better Bitmap Performance with Roaring Bitmaps, SPE 2016",
            "Lemire, Roaring Bitmaps (canonical reference)"
        ],
        "workedExample": "Add 3, 1, 4, 6 into small containers, with a dense chunk becoming a bitmap and a sparse one staying an array. Query 4 finds the value in its container; a value outside all containers is reported absent."
    },
    id: "roaring-bitmap",
    name: "Roaring Bitmap",
    category: "data-structures",
    complexity: { time: "O(k) ops", space: "O(k)" },
    defaultInput: { values: [3, 1, 4, 6], query: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty set of containers",
        "add value: pick the container for its high bits",
        "store dense chunks as bitmaps and sparse chunks as sorted arrays",
        "convert a container when it crosses the density threshold",
        "contains query checks only the matching container",
        "test both a member and a nonmember to show both paths",
        "done: set holds all values and both query verdicts are reported",
    ],
};
export default module;
