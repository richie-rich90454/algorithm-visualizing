/**
 * bloom-filter.ts – Bloom Filter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Bloom filter is a space-efficient probabilistic set. It stores a bit
 * array and k hash functions. Inserting a key sets the k bits at its hash
 * positions; membership checks test those bits. It never gives false
 * negatives, but it can give false positives (a key reported present that was
 * never inserted) as the array fills.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / membership: O(k) – k hash evaluations
 *   Space:               O(m) bits for an m-bit array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The bit array is shown as cells.
 *   - The k bits set by an insert are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "False positives, never false negatives" is the entire trade-off.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Number of hash functions. */
const K = 3;

/** Two string hashes combined to produce k positions. */
function hash1(key: string): number {
    let h = 5381;
    for (const char of key) {
        h = (h * 33 + char.charCodeAt(0)) >>> 0;
    }
    return h;
}
function hash2(key: string): number {
    let h = 0;
    for (const char of key) {
        h = (h * 31 + char.charCodeAt(0)) >>> 0;
    }
    return h;
}

/**
 * The Bloom Filter generator.
 *
 * @param input `{ keys, m, probe }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: string[]; m?: number; probe?: string } | null) ?? {};
    const keys = task.keys ?? ["apple", "banana", "cherry"];
    // Only positive integers size the bit array (`new Array` throws on
    // floats/NaN).
    const rawM = typeof task.m === "number" ? task.m : 20;
    const m = Number.isInteger(rawM) && rawM > 0 ? rawM : 20;
    const probe = task.probe ?? "banana";

    let step = 0;
    const bits = new Array<boolean>(m).fill(false);

    const positions = (key: string): number[] => {
        const h1 = hash1(key);
        const h2 = hash2(key);
        const result: number[] = [];
        for (let i = 0; i < K; i += 1) {
            result.push((((h1 + i * h2) % m) + m) % m);
        }
        return result;
    };

    const makeCells = (active: number[] = []): VisualEntity[] =>
        bits.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: value ? "1" : "0",
            value: value ? 1 : 0,
            state: (active.includes(index)
                ? "comparing"
                : value
                  ? "sorted"
                  : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        }));

    // Frame 0: the empty bit array.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Bloom filter with ${m} bits and ${K} hash functions.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m, k: K },
    };
    step += 1;

    // Insert keys.
    for (const key of keys) {
        const pos = positions(key);
        for (const p of pos) {
            bits[p] = true;
        }
        yield {
            stepNumber: step,
            entities: makeCells(pos),
            edges: [],
            description: `Inserted "${key}" – set bits at [${pos.join(", ")}].`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { m, k: K },
        };
        step += 1;
    }

    // Probe a key.
    const pos = positions(probe);
    const possiblyPresent = pos.every((p) => bits[p]);
    yield {
        stepNumber: step,
        entities: makeCells(pos),
        edges: [],
        description: possiblyPresent
            ? `"${probe}" may be present (all ${K} bits set – possibly a false positive).`
            : `"${probe}" is definitely NOT present (a bit is clear).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { m, k: K, present: possiblyPresent },
    };
}

/** The Bloom Filter module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A Bloom filter is a compact probabilistic set. Insertion sets k bits at k hash positions; a membership test checks those same bits. If any bit is clear the item is definitely absent, while if all are set it is probably present. The structure trades a small false-positive rate for far less memory than storing the keys themselves.",
        "invariants": [
            "A bit, once set to 1, is never cleared because the filter has no deletions.",
            "If a key was inserted, all k of its bits are set, so there are no false negatives.",
            "The k hash positions for a given key are deterministic."
        ],
        "correctness": "Insertion sets every bit a query will test, so an inserted key can never be reported absent. A false positive happens when other keys happen to set all k positions of a non-member; with m bits, k hashes and n items the false-positive rate is approximately (1-e^(-kn/m))^k. The demo labels a positive probe as only 'possibly present' for this reason.",
        "complexityRationale": "Both insert and query compute k hashes and touch k bits, O(k) time independent of how many items are stored. The bit array uses O(m) bits, much less than retaining the keys.",
        "uses": [
            "Avoiding expensive database and disk lookups",
            "Web crawlers checking whether a URL was already fetched",
            "Spell checkers and browser safety lists",
            "Network routing and light-client cryptocurrency filters (BIP37)"
        ],
        "references": [
            "Bloom, Space/Time Trade-offs in Hash Coding with Allowable Errors, Communications of the ACM, 1970",
            "Mitzenmacher and Upfal, Probability and Computing, Chapter 11"
        ],
        "workedExample": "With m=20 and k=3, inserting \"apple\", \"banana\" and \"cherry\" sets three bits per key via double hashing. Probing \"banana\" finds all three of its bits set and reports 'may be present', correctly. A never-inserted key whose three hash positions were all set by other keys would be the false-positive case."
    },
    id: "bloom-filter",
    name: "Bloom Filter",
    category: "data-structures",
    complexity: { time: "O(k)", space: "O(m)" },
    defaultInput: { keys: ["apple", "banana", "cherry"], m: 20, probe: "banana" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize m-bit array to all zeros with k hash functions",
        "compute k hash positions for each key",
        "for each key set its k bits to 1 in the array",
        "probe key maps to k bit positions",
        "if all k bits are set then possibly present",
        "if any bit is clear then definitely not present",
        "done: membership reported with false positives only",
    ],
};

export default module;
