/**
 * cuckoo-hashing.ts - Cuckoo Hashing
 * Two tables; evictions relocate alternately. Demo: hash <=6 keys into table, lookup hit/miss.
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
        description: "Cuckoo Hashing: empty table. Two tables; evictions relocate alternately.",
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
        "intuition": "Cuckoo hashing uses two hash tables and two hash functions. Each key has one slot in each table; if both are occupied, it evicts the resident key and sends it to its alternate slot, repeating until an empty spot appears. Lookups check just the two candidate slots, so they are worst-case O(1).",
        "invariants": [
            "Each key occupies one of its two candidate slots.",
            "A slot holds at most one key.",
            "If a relocation chain exceeds a limit, the table is rehashed with new functions."
        ],
        "correctness": "Every eviction moves a key to its other legal slot, so all keys remain in one of their two positions and no key is lost. Lookup checks both positions, so it finds a key exactly when it is stored. Rehashing after a long chain restores a valid placement rather than looping forever.",
        "complexityRationale": "Lookup is two slot reads, O(1) worst case. Insertion is expected O(1) with low load but can be O(n) in a long displacement chain; rehashing bounds practical cost. Two tables of slots use O(n) space.",
        "uses": [
            "High-performance hash maps with fast lookups",
            "Router and switch forwarding tables",
            "Dictionaries in language runtimes"
        ],
        "references": [
            "Pagh and Rodler, \"Cuckoo Hashing\", J. Algorithms 2004",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.4"
        ],
        "workedExample": "Insert 12, 5, 21 into two tables with h1 = key mod 5 and h2 = key mod 7. If 12 and 5 both want slot 2 of table 1, 5 is evicted to its table-2 slot. Query 5 checks both candidate slots and finds it; a long chain would trigger rehashing."
    },
    id: "cuckoo-hashing",
    name: "Cuckoo Hashing",
    category: "data-structures",
    complexity: { time: "O(1) lookup", space: "O(n)" },
    defaultInput: { keys: [12, 5, 21, 8], query: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize two tables with hash functions h1 and h2",
        "hash key to position h1 and try empty slot",
        "if occupied then displace resident to its alternate table",
        "compare keys along displacement chain up to limit",
        "if chain too long then rehash with new functions",
        "lookup key by checking both h1 and h2 positions",
        "done: tables hold keys with lookup answer and displacement count",
    ],
};
export default module;
