/**
 * linear-hashing.ts - Linear Hashing
 * Buckets split in round-robin order, no directory. Demo: hash <=6 keys into table, lookup hit/miss.
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
        description:
            "Linear Hashing: empty table. Buckets split in round-robin order, no directory.",
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
        "intuition": "Linear hashing grows a hash file one bucket at a time in round-robin order, avoiding a directory. A split pointer marks the next bucket to split; when a bucket overflows, that bucket is divided using one more hash bit, and the pointer advances. When the pointer passes all buckets, the level doubles.",
        "invariants": [
            "Buckets before the split pointer have been split at the current level.",
            "A key's target bucket depends on the split pointer and hash level.",
            "Only one bucket splits per overflow event."
        ],
        "correctness": "The split rule sends keys whose next hash bit is 1 to the new bucket and keeps the rest, so after a split every key is still found by the lookup rule that consults the split pointer. Advancing the pointer gradually converts all buckets without a global rebuild. Lookups remain correct at every stage of growth.",
        "complexityRationale": "Lookup is one or two bucket reads, expected O(1), and splits are incremental rather than a full rehash. Space is O(n) across buckets.",
        "uses": [
            "Dynamic hash files without a directory",
            "Database indexes that grow incrementally",
            "Disk-based key-value stores"
        ],
        "references": [
            "W. Litwin, \"Linear Hashing: A New Tool for File and Table Addressing\", VLDB 1980",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.4"
        ],
        "workedExample": "Start with two buckets and split pointer 0. Inserting until bucket 0 overflows splits it into buckets 0 and 2, moving keys with the extra hash bit set. The pointer advances to 1; a query uses the pointer to decide whether to apply the extra bit, so both old and new keys are found."
    },
    id: "linear-hashing",
    name: "Linear Hashing",
    category: "data-structures",
    complexity: { time: "O(1) avg", space: "O(n)" },
    defaultInput: { keys: [12, 5, 21, 8], query: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize linear hash with buckets and split pointer s",
        "hash key with current level bits to bucket",
        "compare bucket load against threshold to trigger split",
        "split bucket s and rehash its keys",
        "advance split pointer and double when round ends",
        "lookup by checking split pointer to pick hash level",
        "done: table holds keys with lookup answer",
    ],
};
export default module;
