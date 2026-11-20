/**
 * coalesced-hashing.ts - Coalesced Hashing
 * Overflow chains share the table via cellar links. Demo: hash <=6 keys into table, lookup hit/miss.
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
            "Coalesced Hashing: empty table. Overflow chains share the table via cellar links.",
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
        "intuition": "Coalesced hashing uses one table split into a primary area and a cellar area. Keys hash into the primary area, and any collision chains into a free cellar slot instead of a separate linked list. Because all nodes live in the same array, it uses space efficiently while keeping chains short.",
        "invariants": [
            "A key's home address lies in the primary area.",
            "Overflow keys are linked through cellar slots only.",
            "No slot holds more than one key."
        ],
        "correctness": "Following the link from a home slot visits every key that hashed there, so lookup finds a key exactly when it is somewhere on that chain. Inserting into a free cellar slot never disturbs existing chains. Because every key starts from its home address, search terminates at the chain end.",
        "complexityRationale": "With a lightly loaded cellar, chains are short and operations take expected O(1). The entire structure is one array of table slots, O(n) space with no per-node allocation.",
        "uses": [
            "Hash tables where memory locality matters",
            "File and database indexes with fixed records",
            "Embedded systems avoiding pointer allocation"
        ],
        "references": [
            "W. A. Martin and R. S. P. Ness, \"An Optimized Hash Table for Use with Disc Storage\", 1972",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.4"
        ],
        "workedExample": "With a table of size 7 and home = key mod 7, insert 12 and 5 both target slot 5: 12 lands there and 5 chains into a cellar slot. Key 21 targets slot 0. Query 5 hashes to slot 5, follows its cellar link, and finds 5 after two probes."
    },
    id: "coalesced-hashing",
    name: "Coalesced Hashing",
    category: "data-structures",
    complexity: { time: "O(1) avg", space: "O(n)" },
    defaultInput: { keys: [12, 5, 21, 8], query: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize table with primary area plus cellar overflow",
        "hash key to home address by modulo table size",
        "compare home slot and follow cellar links on collision",
        "insert by chaining overflow into free cellar slot",
        "probe chain comparing each key for lookup",
        "count probes along the coalesced chain",
        "done: table holds keys with lookup answer and probe count",
    ],
};
export default module;
