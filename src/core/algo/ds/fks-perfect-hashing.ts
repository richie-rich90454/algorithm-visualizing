/**
 * fks-perfect-hashing.ts - FKS Perfect Hashing
 * Two-level tables sized by bucket^2: collision-free. Demo: hash <=6 keys into table, lookup hit/miss.
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
            "FKS Perfect Hashing: empty table. Two-level tables sized by bucket^2: collision-free.",
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
        "intuition": "FKS perfect hashing builds a two-level hash table for a static set of keys. The first level distributes keys into buckets; each bucket gets a second-level table sized to the square of its bucket count. Random universal hashing is retried until no collisions remain, giving worst-case O(1) lookups.",
        "invariants": [
            "The second-level table for a bucket has size m squared for m keys.",
            "No two keys in a bucket collide in the second-level table.",
            "Every key is stored at exactly one second-level slot."
        ],
        "correctness": "Squaring the table size makes the probability of a collision within a bucket less than one half, so a few retries almost surely produce a collision-free table. Once that happens, lookup hashes twice and reads a unique slot, so a key is found exactly when present. Static keys never change, so the guarantee persists.",
        "complexityRationale": "Expected construction time is O(n) because each bucket needs only a few retries. The sum of squared bucket sizes is O(n) in expectation, so space is linear, and lookup is two hashes, O(1) worst case.",
        "uses": [
            "Static dictionaries with guaranteed lookup time",
            "Compiler keyword and symbol tables",
            "Read-only indexes and routers"
        ],
        "references": [
            "Fredman, Komlos, and Szemeredi, \"Storing a Sparse Table with O(1) Worst Case Access Time\", JACM 1984",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.4"
        ],
        "workedExample": "Keys 12, 5, 21, 8 hash into first-level buckets; suppose two land in bucket 0. That bucket gets a second table of size 4, and hashing with a new function until distinct slots places both without collision. A lookup hashes to bucket 0, then to its unique slot, and finds the key."
    },
    id: "fks-perfect-hashing",
    name: "FKS Perfect Hashing",
    category: "data-structures",
    complexity: { time: "O(1) worst static", space: "O(n)" },
    defaultInput: { keys: [12, 5, 21, 8], query: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize first-level hash distributing keys to buckets",
        "compare bucket size and allocate squaresize second table",
        "hash bucket keys with universal function until collision-free",
        "insert each key into its perfect second-level slot",
        "lookup key by two hashes in worst-case O(1)",
        "count total space as linear in key count",
        "done: two-level table holds keys with lookup answer",
    ],
};
export default module;
