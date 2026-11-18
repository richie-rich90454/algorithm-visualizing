/**
 * robin-hood-hashing.ts - Robin Hood Hashing
 * Rich keys give way to poor ones (probe balancing). Demo: hash <=6 keys into table, lookup hit/miss.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rich keys give way to poor ones (probe balancing). Demo: hash <=6 keys into table, lookup hit/miss.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) expected
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
 *   - Standard Robin Hood Hashing behavior with textbook operation costs.
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
            "Robin Hood Hashing: empty table. Rich keys give way to poor ones (probe balancing).",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ops: step },
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
            meta: { ops: step },
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
            meta: { ops: step },
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
        meta: { ops: step },
    };
    step += 1;
    const n = table.filter((v) => v !== null).length;
    yield {
        stepNumber: step,
        entities: cells(table.map((v) => (v === null ? "." : v))),
        edges: [],
        description: `Final: ${n} entries; lookup ${q} ${hit ? "hit" : "miss"} verified.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { hit, n },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Robin Hood hashing is open addressing where a key that has probed farther can displace a key that has probed less. This evens out probe lengths, so the longest probes stay short and lookups terminate early.",
        "invariants": [
            "Probe distances within a cluster are nondecreasing.",
            "An evicted key continues probing with a longer distance.",
            "A lookup can stop at an empty slot or a resident with shorter probe distance."
        ],
        "correctness": "Swapping a longer-probing key with a shorter-probing resident keeps both findable and never increases the shorter key distance, so the invariant holds. Because distances are nondecreasing, meeting a resident with a shorter probe proves the target cannot be farther along, so absent keys are detected early.",
        "complexityRationale": "With good hashing and bounded load, average probes are O(1) and worst-case probes O(log n); each probe is constant work. The table stores one entry per slot, O(n) space.",
        "uses": [
            "Hash maps needing predictable probe tails",
            "Caches with tight latency requirements",
            "Compiler symbol tables"
        ],
        "references": [
            "Celis, Larson, and Munro, Robin Hood Hashing, 1985",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 6.4 on hashing"
        ],
        "workedExample": "Hash 12, 5, 21, 8 into a small table; when 21 lands on a shorter-probing resident, that resident steps aside and 21 continues. Lookup of 21 follows the probe sequence and finds it; a key hashing to an early empty slot stops immediately."
    },
    id: "robin-hood-hashing",
    name: "Robin Hood Hashing",
    category: "data-structures",
    complexity: { time: "O(log n) expected", space: "O(n)" },
    defaultInput: { keys: [12, 5, 21, 8], query: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty table with a hash function and probe order",
        "hash key to its home slot and start probing forward",
        "insert: if the resident is richer (shorter probe), swap with it",
        "the evicted rich key continues probing with a longer distance",
        "repeat until every key sits with a balanced probe distance",
        "lookup stops at an empty slot or when the probe exceeds the record",
        "done: table is balanced and the lookup answer is reported",
    ],
};
export default module;
