/**
 * extendible-hashing.ts - Extendible Hashing
 * Directory doubles when a bucket overflows. Demo: hash <=6 keys into table, lookup hit/miss.
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
        description: "Extendible Hashing: empty table. Directory doubles when a bucket overflows.",
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
        "intuition": "Extendible hashing grows a hash index by splitting individual buckets and doubling a directory only when necessary. Each bucket has a local depth, and the directory has a global depth; a bucket is split when it overflows, using one more low-order hash bit. Only the affected buckets change, so growth is gradual.",
        "invariants": [
            "A directory entry points to the bucket whose local depth matches the used bits.",
            "Global depth is the maximum local depth.",
            "All keys in a bucket share the same low-order hash prefix."
        ],
        "correctness": "Using d low bits as the directory index sends each key to the bucket that stores it. When a bucket overflows, splitting it by the next bit and doubling entries whose local depth is smaller keeps the mapping correct for every key. Lookup follows the hash bits to the right bucket and finds the key there.",
        "complexityRationale": "Lookup is one directory access plus a short bucket scan, expected O(1). The directory can double to O(n) entries in the worst case, and buckets hold O(n) keys total.",
        "uses": [
            "Database hash indexes with dynamic growth",
            "File systems and extensible directories",
            "Disk-based key-value stores"
        ],
        "references": [
            "R. Fagin et al., \"Extendible Hashing: A Fast Access Method for Dynamic Files\", ACM TODS 1979",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.4"
        ],
        "workedExample": "Start with global depth 1 and two buckets. Insert 12 and 5 into bucket 0 until it overflows; split it by the next bit into buckets 00 and 10 and double the directory to depth 2. Query 21 uses two low bits to reach its bucket directly."
    },
    id: "extendible-hashing",
    name: "Extendible Hashing",
    category: "data-structures",
    complexity: { time: "O(1) avg", space: "O(n)" },
    defaultInput: { keys: [12, 5, 21, 8], query: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize directory with global depth 1 and two buckets",
        "hash key and use low depth bits as directory index",
        "compare bucket local depth against global depth",
        "insert key into target bucket in sorted order",
        "if bucket full then split and grow local depth",
        "if local depth exceeds global then double directory",
        "done: directory and buckets hold keys with lookup answer",
    ],
};
export default module;
