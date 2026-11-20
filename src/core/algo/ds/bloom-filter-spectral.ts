/**
 * bloom-filter-spectral.ts - Spectral Bloom Filter with frequency estimates.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A spectral bloom filter replaces the bits of an ordinary bloom filter with
 * small counters. Adding a key increments each of its k counters; removing a
 * key decrements them. Querying a key returns the minimum of its k counters,
 * which is an upper bound on the key's true multiplicity and is never an
 * underestimate: every counter the key touches includes at least its own
 * occurrences. A zero estimate proves the key was never inserted (no false
 * negatives), while a positive estimate means it may be present.
 *
 * This is distinct from the counting bloom filter module, which uses counters
 * only for membership and deletion and never reports a frequency estimate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) per insert, remove, or query; k is a small constant
 *   Space: O(m) counters for m buckets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Counters are shown as grid cells; touched buckets flash COMPARING.
 *   - The caption reports each add/remove and each frequency estimate.
 *   - meta.frequencies records the last query results for the stats panel.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const M = 16;
const SEEDS = [1, 2, 3];

/** k deterministic hash positions for a key. */
function positions(key: number): number[] {
    return SEEDS.map((seed) => {
        const raw = key * (seed * 37 + 11) + seed * 7;
        return ((raw % M) + M) % M;
    });
}

function cells(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

interface SpectralInput {
    keys?: number[];
    queries?: number[];
    removes?: number[];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SpectralInput | null) ?? {};
    const keys = Array.isArray(task.keys) ? task.keys.slice(0, 12) : [5, 17, 9];
    const removes = Array.isArray(task.removes) ? task.removes.slice(0, 12) : [];
    const queries = Array.isArray(task.queries)
        ? task.queries.slice(0, 12)
        : [5, 17, 9, 42];

    const counters = new Array<number>(M).fill(0);
    let step = 0;
    const frame = (description: string, line: number, states: Map<number, EntityState>, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: cells(counters, states),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta,
    });

    yield frame("Spectral Bloom Filter: empty counters; estimates use the minimum of k buckets.", 0, new Map(), {
        operations: 0,
        frequencies: [],
    });
    step += 1;

    for (const key of keys) {
        const pos = positions(key);
        for (const j of pos) counters[j] = (counters[j] ?? 0) + 1;
        yield frame(`Add ${key}: increment buckets ${pos.join(", ")}.`, 1, new Map(pos.map((j) => [j, "comparing" as EntityState])), {
            operations: step,
            added: key,
        });
        step += 1;
    }

    for (const key of removes) {
        const pos = positions(key);
        for (const j of pos) counters[j] = Math.max(0, (counters[j] ?? 0) - 1);
        yield frame(`Remove ${key}: decrement buckets ${pos.join(", ")}.`, 2, new Map(pos.map((j) => [j, "comparing" as EntityState])), {
            operations: step,
            removed: key,
        });
        step += 1;
    }

    const frequencies: number[] = [];
    for (const key of queries) {
        const pos = positions(key);
        const estimate = Math.min(...pos.map((j) => counters[j] ?? 0));
        frequencies.push(estimate);
        yield frame(
            `Query ${key}: buckets ${pos.join(", ")} -> minimum counter ${estimate} (${estimate > 0 ? "possibly present" : "definitely absent"}).`,
            3,
            new Map(pos.map((j) => [j, estimate > 0 ? "sorted" : "error" as EntityState])),
            { operations: step, queried: key, estimate },
        );
        step += 1;
    }

    yield frame(
        `Done: ${keys.length} key(s) added, ${removes.length} removed; estimates never fall below true counts.`,
        4,
        new Map(),
        { operations: step, frequencies, buckets: M },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a bloom filter where each bucket is a small counter instead of a single bit. Inserting a key bumps its buckets up; deleting bumps them down. To guess how many times a key was inserted, read all of its buckets and take the smallest count. Because every one of those buckets was bumped by each insertion of the key, the minimum can only be too high, never too low.",
        invariants: [
            "Every counter is a nonnegative integer.",
            "For any key with true multiplicity c, each of its k bucket counters is at least c.",
            "A query estimate, the minimum of those counters, is therefore at least c.",
            "A zero estimate implies the key was never inserted, so there are no false negatives.",
        ],
        correctness:
            "Each insertion of a key increments all k of its buckets, so after c insertions every such bucket has a value of at least c even if other keys also increment it. Taking the minimum yields an estimate that is always greater than or equal to c, so the filter never undercounts. If a key was never inserted, none of its buckets were incremented on its behalf; they can be nonzero from other keys, which is a false positive, but if the minimum is zero the key is certainly absent. Decrements are capped at zero so counters cannot wrap negative.",
        complexityRationale:
            "Each operation computes k hashes and touches k counters, so time is O(k), independent of the number of stored keys. The counter array has m entries, giving O(m) space; with fixed-width counters this is a small constant factor over a plain bloom filter.",
        uses: [
            "Estimating per-key request frequencies in network traffic monitoring",
            "Approximate counting in streaming and database systems",
            "Deletable membership sets that also report rough multiplicities",
        ],
        references: [
            "Cohen and Kaplan, Leveraging Discarded Bits for Better Counting, 2003",
            "Bloom, Space/Time Trade-offs in Hash Coding with Allowable Errors, 1970",
        ],
        workedExample:
            "With 16 buckets and hashes key*37+11, key*85+22, key*133+33: inserting key 5 bumps buckets 2, 14, 10; inserting it again bumps them again. Querying 5 reads those buckets and returns their minimum of 2, matching its true count when no other key collided. Querying a never-seen key that maps to an untouched bucket returns 0, proving absence.",
    },
    id: "bloom-filter-spectral",
    name: "Spectral Bloom Filter",
    category: "data-structures",
    complexity: { time: "O(k)", space: "O(m)" },
    defaultInput: { keys: [5, 17, 9], removes: [], queries: [5, 17, 9, 42] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize m counters to zero and choose k hash functions",
        "to add key: increment all k buckets of the key",
        "to remove key: decrement all k buckets, never below zero",
        "to query key: let e be the minimum of its k buckets",
        "report e as the estimated frequency of the key",
        "if e is zero the key is definitely absent; otherwise maybe present",
        "done: estimates are upper bounds and never underestimate",
    ],
};

export default module;
