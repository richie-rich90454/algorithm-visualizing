/**
 * counting-bloom-filter.ts - Counting Bloom Filter
 * Counters allow deletes; query checks all k > 0. Demo: add <=5 keys, query member + nonmember.
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
const M = 12;
const hs = (k: number): number[] => [(((k * 31 + 7) % M) + M) % M, (((k * 131 + 17) % M) + M) % M];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = (Array.isArray(t.keys) ? t.keys : [5, 17, 9]).slice(0, 8);
    const q = typeof t.query === "number" ? t.query : 17;
    const bits = new Array<number>(M).fill(0);
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(bits),
        edges: [],
        description:
            "Counting Bloom Filter: empty filter. Counters allow deletes; query checks all k > 0.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { operations: step },
    };
    step += 1;
    for (const k of keys) {
        for (const j of hs(k)) bits[j] = Math.min(9, (bits[j] ?? 0) + 1);
        yield {
            stepNumber: step,
            entities: cells(
                bits,
                new Map(hs(k).map((j) => [j, "comparing"] as [number, EntityState])),
            ),
            edges: [],
            description: `Add ${k} -> positions ${hs(k).join(", ")}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { operations: step },
        };
        step += 1;
    }
    const maybe = (k: number): boolean => hs(k).every((j) => (bits[j] ?? 0) > 0);
    const hit = maybe(q);
    yield {
        stepNumber: step,
        entities: cells(bits),
        edges: [],
        description: `Query ${q}: ${hit ? "possibly present" : "definitely absent"}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { operations: step },
    };
    step += 1;
    const miss = 999;
    const mhit = maybe(miss);
    yield {
        stepNumber: step,
        entities: cells(bits),
        edges: [],
        description: `Query ${miss}: ${mhit ? "possibly present (fp)" : "definitely absent"}. Member ${q} test ${hit ? "passed" : "FAILED (check hashes)"} verified.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { hit },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A counting Bloom filter replaces each bit of a standard Bloom filter with a small counter. Inserting a key increments k counters, and deleting it decrements them, so the filter supports dynamic sets. Membership still reports present when all k counters are positive, with false positives but no false negatives.",
        "invariants": [
            "Each counter equals the number of stored keys hashing to it.",
            "Counters never go negative.",
            "A key is reported present only if all k counters are positive."
        ],
        "correctness": "Incrementing on insert makes a stored key's counters all positive, so it is never reported absent. Deleting decrements exactly the counters that the key incremented, preserving the count invariant. False positives can occur when other keys set the same counters, but a true member is always found.",
        "complexityRationale": "Each operation evaluates k hashes and touches k counters, O(k) time. With m counters the space is O(m), typically a few bits per key times the counter width.",
        "uses": [
            "Dynamic membership filters with deletions",
            "Cache and proxy deduplication",
            "Routing tables that update on the fly"
        ],
        "references": [
            "Li Fan, Pei Cao, Jussara Almeida, and Andrei Z. Broder, \"Summary Cache: A Scalable Wide-Area Web Cache Sharing Protocol\", SIGCOMM 1998",
            "Burton H. Bloom, \"Space/Time Trade-offs in Hash Coding with Allowable Errors\", CACM 1970"
        ],
        "workedExample": "Insert 5 and 17 with k=3 counters: each key increments three hashed counters. Query 17 finds all three counters positive and reports present. Delete 5 by decrementing its counters; a later query for 17 still succeeds, while a query for a never-inserted key whose counters include a zero fails."
    },
    id: "counting-bloom-filter",
    name: "Counting Bloom Filter",
    category: "data-structures",
    complexity: { time: "O(k) ops", space: "O(m)" },
    defaultInput: { keys: [5, 17, 9], query: 17 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize counting Bloom filter with zeroed counters",
        "hash key with k functions to k counter positions",
        "increment each hashed counter to add key",
        "compare query counters and report present if all nonzero",
        "decrement counters to delete key",
        "count nonzero counters for fill ratio",
        "done: filter holds keys with membership answer",
    ],
};
export default module;
