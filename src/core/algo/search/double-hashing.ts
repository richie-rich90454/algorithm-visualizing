/**
 * double-hashing.ts - Double Hashing Open Addressing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Double hashing is an open addressing scheme that avoids the primary
 * clustering of linear probing. A second independent hash supplies the step
 * size, so keys that collide in their home bucket follow different probe
 * sequences. With a prime table size and a step between one and table size
 * minus one, the sequence visits every bucket before repeating. Lookups follow
 * the identical sequence and stop at the first empty bucket.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) expected per insert or lookup, O(m) worst case
 *   Space: O(m) for the bucket array of m slots
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per bucket shows the key it holds.
 *   - Insertions and probe steps highlight the bucket being examined.
 *   - The final frame reports the home bucket, step, and lookup result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DoubleHashInput {
    keys?: string[];
    buckets?: number;
    probe?: string;
}

/** Polynomial hash for the home bucket. */
function hashHome(key: string, buckets: number): number {
    let hash = 0;
    for (const character of key) {
        hash = (hash * 31 + character.charCodeAt(0)) % buckets;
    }
    return hash;
}

/** Independent polynomial hash for the step, always in one to buckets minus one. */
function hashStep(key: string, buckets: number): number {
    let hash = 0;
    for (const character of key) {
        hash = (hash * 37 + character.charCodeAt(0)) % (buckets - 1);
    }
    return 1 + hash;
}

/** Build one cell per bucket. */
function makeCells(table: Array<string | null>, active: number): VisualEntity[] {
    return table.map((key, index) => {
        let state: EntityState = key === null ? "unvisited" : "sorted";
        if (index === active) {
            state = "comparing";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: key ?? "",
            value: key ?? "",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, key: key ?? "" },
        };
    });
}

/** The double hashing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DoubleHashInput | null) ?? {};
    const keys: string[] = Array.isArray(task.keys) ? task.keys.map((key) => String(key)) : ["cat", "car", "dog", "cow", "bat", "rat"];
    const buckets = Math.max(3, Math.floor(task.buckets ?? 11));
    const probeKey = typeof task.probe === "string" ? task.probe : "dog";
    const table: Array<string | null> = new Array<string | null>(buckets).fill(null);
    const baseMeta = {
        buckets,
        keys: [...keys],
        probe: probeKey,
        table: [] as string[],
        home: 0,
        step: 0,
        probeSequence: [] as number[],
        found: false,
        probes: 0,
    };
    const snapshot = (): string[] => table.map((key) => key ?? "");

    yield {
        stepNumber: 0,
        entities: makeCells(table, -1),
        edges: [],
        description: `Empty ${buckets}-bucket table; inserting ${keys.length} key(s) with two independent hashes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, table: snapshot(), rows: 1, cols: buckets },
    };
    let step = 1;

    for (const key of keys) {
        const home = hashHome(key, buckets);
        const stride = hashStep(key, buckets);
        let placed = false;
        for (let i = 0; i < buckets && !placed; i += 1) {
            const slot = (home + i * stride) % buckets;
            if (table[slot] === null) {
                table[slot] = key;
                placed = true;
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(table, hashHome(key, buckets)),
            edges: [],
            description: `Inserted "${key}" at bucket ${table.indexOf(key)} using home ${home} and step ${stride}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...baseMeta, table: snapshot(), rows: 1, cols: buckets, lastKey: key },
        };
        step += 1;
    }

    const home = hashHome(probeKey, buckets);
    const stride = hashStep(probeKey, buckets);
    const probeSequence: number[] = [];
    let found = false;
    for (let i = 0; i < buckets; i += 1) {
        const slot = (home + i * stride) % buckets;
        const occupant = table[slot];
        probeSequence.push(slot);
        if (occupant === probeKey) {
            found = true;
            break;
        }
        if (occupant === null) {
            break;
        }
        yield {
            stepNumber: step,
            entities: makeCells(table, slot),
            edges: [],
            description: `Probe ${i + 1}: bucket ${slot} holds "${occupant}", continue with step ${stride}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { ...baseMeta, table: snapshot(), home, step: stride, probeSequence: [...probeSequence], rows: 1, cols: buckets },
        };
        step += 1;
    }
    if (found) {
        const slot = probeSequence[probeSequence.length - 1] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(table, slot),
            edges: [],
            description: `Found "${probeKey}" at bucket ${slot} after ${probeSequence.length} probe(s).`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { ...baseMeta, table: snapshot(), home, step: stride, probeSequence, found, probes: probeSequence.length, rows: 1, cols: buckets },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(table, -1),
        edges: [],
        description: found
            ? `Lookup for "${probeKey}" succeeded; the table holds ${keys.length} key(s).`
            : `Lookup for "${probeKey}" failed after ${probeSequence.length} probe(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...baseMeta, table: snapshot(), home, step: stride, probeSequence, found, probes: probeSequence.length, rows: 1, cols: buckets },
    };
}

/** The double hashing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Linear probing sends colliding keys to neighboring buckets, which builds long clusters. Double hashing instead derives a jump size from a second hash, so each key has its own stride. Keys that start in the same bucket spread out in different directions, and when the table size is prime the stride eventually visits every bucket.",
        invariants: [
            "A key is always stored at the first empty bucket on its own probe sequence.",
            "Insertion and lookup use the same home hash and the same step hash.",
            "With a prime table size and a step in one to table size minus one, the probe sequence visits distinct buckets until it repeats.",
        ],
        correctness:
            "The step hash never returns zero, so the probe sequence advances. Because a prime modulus has no nontrivial divisors, a step that is not a multiple of the table size generates a full cycle of distinct buckets, so an insertion finds an empty slot whenever one exists and a lookup cannot miss a key that was placed. Following the identical sequence from the same home bucket therefore finds the key at the recorded position, and stopping at an empty bucket proves the key is absent because insertion would have used that bucket first.",
        complexityRationale:
            "At low load factor a probe sequence reaches an empty or matching bucket after a constant number of steps, giving expected O(1) per operation; in the worst case it scans all m buckets, O(m). The bucket array is the only storage, O(m) space.",
        uses: [
            "Language runtime hash tables that need low clustering",
            "Symbol tables with many colliding keys",
            "Database index buckets under adversarial inputs",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, Section 6.4",
            "CLRS, Introduction to Algorithms, Chapter 11",
        ],
        workedExample:
            "In an eleven bucket table, cat hashes home to bucket 10 with step 4. If bucket 10 were occupied, the next probes would be 3, 7, and 0. A different key with the same home but step 3 would visit 2, 5, and 8, so the two keys do not pile into the same cluster.",
    },
    id: "double-hashing",
    name: "Double Hashing",
    category: "searching",
    complexity: { time: "O(1) expected", space: "O(m)" },
    defaultInput: { keys: ["cat", "car", "dog", "cow", "bat", "rat"], buckets: 11, probe: "dog" },
    visualType: "grid",
    run,
    pseudocode: [
        "read the keys, a prime bucket count, and the probe key",
        "start with every bucket empty",
        "for each key compute a home bucket and a nonzero step from two hashes",
        "probe home plus i times step modulo the bucket count until a slot is free",
        "store the key in the first free slot on that sequence",
        "look up the probe key by walking its own sequence",
        "stop at the key or at the first empty bucket",
        "done: report the table and the lookup result",
    ],
};

export default module;
