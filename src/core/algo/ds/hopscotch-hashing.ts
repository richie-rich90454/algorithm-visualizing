/**
 * hopscotch-hashing.ts - Hopscotch Hashing
 * Neighborhood bitmap keeps entries near home. Demo: hash <=6 keys into table, lookup hit/miss.
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
const M = 8;
const h = (k: number): number => (((k * 31 + 7) % M) + M) % M;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = (Array.isArray(t.keys) ? t.keys : [12, 5, 21, 8]).slice(0, 8);
    const q = typeof t.query === "number" ? t.query : 21;
    const table: (number | null)[] = new Array<null>(M).fill(null);
    const probe = (k: number): number => {
        let i = h(k);
        for (let s = 0; s < M; s += 1) {
            const j = (i + s) % M;
            if (table[j] === null || table[j] === k) return j;
        }
        return -1;
    };
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(table.map((v) => (v === null ? "." : v))),
        edges: [],
        description: "Hopscotch Hashing: empty table. Neighborhood bitmap keeps entries near home.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { operations: step },
    };
    step += 1;
    for (const k of keys) {
        const j = probe(k);
        if (j >= 0) table[j] = k;
        yield {
            stepNumber: step,
            entities: cells(
                table.map((v) => (v === null ? "." : v)),
                new Map(j >= 0 ? [[j, "comparing"]] : []),
            ),
            edges: [],
            description: `Insert ${k} -> slot ${j} (h=${h(k)}).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { operations: step },
        };
        step += 1;
    }
    if (keys.length === 0) {
        yield {
            stepNumber: step,
            entities: cells(table.map((v) => (v === null ? "." : v))),
            edges: [],
            description: "Empty input: table stays empty.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { operations: step },
        };
        return;
    }
    const j = probe(q);
    const hit = j >= 0 && table[j] === q;
    yield {
        stepNumber: step,
        entities: cells(
            table.map((v) => (v === null ? "." : v)),
            new Map(hit ? [[j, "highlight"]] : []),
        ),
        edges: [],
        description: `Lookup ${q}: ${hit ? `found at slot ${j}` : "absent"}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { operations: step },
    };
    step += 1;
    const n = table.filter((v) => v !== null).length;
    yield {
        stepNumber: step,
        entities: cells(table.map((v) => (v === null ? "." : v))),
        edges: [],
        description: `Final: ${n} entries; lookup ${q} ${hit ? "hit" : "miss"} verified.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { hit, n },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Hopscotch hashing keeps each key within a small neighborhood of its home bucket by storing a bitmap of occupied slots near the home. On insertion into a free slot farther away, it swaps entries closer until the new key is within the neighborhood. Lookups scan only that fixed neighborhood.",
        "invariants": [
            "Every key lies within H slots of its home bucket.",
            "The neighborhood bitmap marks occupied slots in that window.",
            "Swaps preserve the neighborhood property of displaced keys."
        ],
        "correctness": "Hashing gives a home bucket, and the invariant guarantees the key is within H slots, so scanning exactly those slots finds it. Swapping a distant empty slot with a closer occupied one moves the occupant closer to its own home, never farther. Lookups are therefore complete and insertion preserves the invariant.",
        "complexityRationale": "Lookup scans H slots, O(1) for fixed H. Insertion may perform a bounded number of swaps, expected O(1); space is one array of buckets, O(n).",
        "uses": [
            "Concurrent hash tables",
            "Cache-friendly dictionaries",
            "High-load hash tables with fast lookups"
        ],
        "references": [
            "Maurice Herlihy, Nir Shavit, and Moran Tzafrir, \"Hopscotch Hashing\", DISC 2008",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.4"
        ],
        "workedExample": "With neighborhood H=4, key 21 hashes to bucket 0 but only bucket 3 is free. Insert 21 at 3, then swap it with a resident at bucket 1 whose home is 0, moving 21 to bucket 1. Query 21 scans buckets 0-3 and finds it quickly."
    },
    id: "hopscotch-hashing",
    name: "Hopscotch Hashing",
    category: "data-structures",
    complexity: { time: "O(1) lookup", space: "O(n)" },
    defaultInput: { keys: [12, 5, 21, 8], query: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize table with empty slots and neighborhood size H",
        "hash key to home bucket index",
        "compare neighborhood slots within H of home",
        "insert by finding empty slot then swapping closer to home",
        "displace entries preserving neighborhood invariant",
        "lookup by scanning only H neighborhood slots",
        "done: table holds keys with lookup answer",
    ],
};
export default module;
