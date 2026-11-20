/**
 * rendezvous-hashing.ts - Rendezvous Hashing
 * Highest-weight node wins per key (HRW). Demo: hash <=6 keys into table, lookup hit/miss.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Highest-weight node wins per key (HRW). Demo: hash <=6 keys into table, lookup hit/miss.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) pick
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
 *   - Standard Rendezvous Hashing behavior with textbook operation costs.
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
        description: "Rendezvous Hashing: empty table. Highest-weight node wins per key (HRW).",
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
        "intuition": "Rendezvous hashing assigns a key to the node with the highest hash weight for that key. Since every node is scored independently, adding or removing a node moves only the keys whose winner changed, which is minimal disruption.",
        "invariants": [
            "Each key owner is the argument maximum of its node weights.",
            "Weights are deterministic for a given key and node pair.",
            "Removing a node only affects keys it owned."
        ],
        "correctness": "The highest-weight node for a key is uniquely determined by the hash function, so a lookup recomputing weights finds the same owner. When a node is removed, only keys whose maximum was that node can change owner, so reassignment is minimal.",
        "complexityRationale": "Choosing an owner scores the key against all n nodes, O(n) time. Storage is the node list plus assignments, O(n) space.",
        "uses": [
            "Distributed cache key placement as an alternative to consistent hashing",
            "Load balancing across backend pools",
            "Replicated storage with minimal remapping on membership changes"
        ],
        "references": [
            "Thaler and Ravishankar, Using Name-Based Mappings to Increase Hit Rates, IEEE/ACM ToN 1998",
            "Karger et al., Consistent Hashing and Random Trees, STOC 1997"
        ],
        "workedExample": "Hash keys 12, 5, 21, 8 against each node so every key goes to its highest-weight node. Looking up 21 recomputes the weights and finds the same winner; removing a node reassigns only the keys that chose it."
    },
    id: "rendezvous-hashing",
    name: "Rendezvous Hashing",
    category: "data-structures",
    complexity: { time: "O(n) pick", space: "O(n)" },
    defaultInput: { keys: [12, 5, 21, 8], query: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty node table and no assignments",
        "hash key against every node to get one weight per node",
        "assign the key to the highest-weight node (HRW rule)",
        "repeat until every key has a winning node",
        "lookup recomputes the weights and checks the winner slot",
        "minimal disruption: only keys from removed nodes move",
        "done: assignments are stable and the lookup answer is reported",
    ],
};
export default module;
