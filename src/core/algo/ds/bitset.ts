/**
 * bitset.ts - Bitset
 * One bit per value; AND/OR are word-parallel. Demo: add <=6 values, test hit + miss.
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
        description: "Bitset: empty. One bit per value; AND/OR are word-parallel.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { operations: step },
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
            meta: { operations: step },
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
            meta: { operations: step },
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
        meta: { operations: step },
    };
    step += 1;
    const miss = 999;
    const mhit = set.has(miss);
    yield {
        stepNumber: step,
        entities: cells(arr, new Map()),
        edges: [],
        description: `Contains ${miss}: ${mhit}. Final size ${set.size}; query ${q} ${hit ? "present" : "absent"} verified.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { hit, size: set.size },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A bitset stores membership of values as individual bits in an array of machine words. Testing a value is a single bit read, and bulk operations such as union and intersection run a whole word at a time using bitwise AND and OR. It is the densest possible representation when the universe of values is small.",
        "invariants": [
            "Bit i is 1 exactly when value i is in the set.",
            "All bits beyond the universe size remain 0.",
            "Cardinality equals the number of set bits."
        ],
        "correctness": "Setting a bit records membership and clearing it removes membership, so a membership test reads exactly the right bit. Bitwise OR computes union because a bit is set in either operand, and AND computes intersection because a bit is set in both. Counting set bits therefore yields the set size.",
        "complexityRationale": "Membership, insertion, and deletion are O(1) word operations. A universe of u values uses u/w machine words, so space is O(u/w), and bulk Boolean operations run in O(u/w).",
        "uses": [
            "Fast membership tests and deduplication",
            "Database bitmap indexes",
            "Representing flags and graph adjacency in solvers"
        ],
        "references": [
            "Donald Knuth, The Art of Computer Programming, Vol. 4A, Section 7.1.3",
            "Robert Sedgewick and Kevin Wayne, Algorithms, Section 1.1 bitset exercises"
        ],
        "workedExample": "With values 3, 1, 4, 6 added to an 8-bit set, the pattern for values 0 through 7 is 0 1 0 1 1 0 1 0. Query 4 reads bit 4 and finds 1, so 4 is present; query 5 reads bit 5 and finds 0, so 5 is absent. The cardinality is four set bits."
    },
    id: "bitset",
    name: "Bitset",
    category: "data-structures",
    complexity: { time: "O(1) test", space: "O(u/w)" },
    defaultInput: { values: [3, 1, 4, 6], query: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty bitset with all bits cleared",
        "hash value to bit index by modulo capacity",
        "set bit to 1 to add value to the set",
        "compare query bit against stored bits for membership",
        "clear bit to 0 to remove value",
        "count set bits for cardinality",
        "done: bitset holds values with membership answer",
    ],
};
export default module;
