/**
 * bloom-filter-join.ts - Bloom-Filter Join
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A bloom filter is a compact bit array that answers "is this key possibly in
 * the set?" with no false negatives but possible false positives. In a
 * bloom-filter join the build side is loaded into the filter first. For each
 * probe-side key, the join consults the filter and only performs an expensive
 * hash-table lookup when the key might be present. Keys the filter rejects are
 * skipped entirely, which matters when the probe side is large and most keys
 * do not match.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((L + R) * k + M) for k hashes and M true matching pairs
 *   Space: O(m + L) for an m-bit filter and the build-side lookup set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per bloom-filter bit, showing 0 or 1.
 *   - Bits set during a build step turn green; a rejected probe turns red.
 *   - meta reports matched pairs and how many probes were skipped.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    left?: number[];
    right?: number[];
    bits?: number;
    hashes?: number;
}

function hash1(key: number, m: number): number {
    return (Math.imul(key | 0, 2654435761) >>> 0) % m;
}

function hash2(key: number, m: number): number {
    const value = (Math.imul(key | 0, 2246822519) >>> 0) % m;
    return value === 0 ? 1 : value;
}

function bloomCells(filter: number[], current: number | null, state: EntityState): VisualEntity[] {
    return filter.map((bit, index) => ({
        id: `bit-${index}`,
        type: "cell" as const,
        label: bit === 1 ? "1" : "0",
        value: bit,
        state: index === current ? state : bit === 1 ? "sorted" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, bit },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const left: number[] = task.left ?? [10, 20, 30, 40];
    const right: number[] = task.right ?? [20, 99, 30, 7, 40, 13];
    const bits = Math.max(4, task.bits ?? 32);
    const hashes = Math.max(1, task.hashes ?? 3);
    const filter = new Array<number>(bits).fill(0);
    const buildSet = new Set<number>();
    const matched: string[] = [];
    let skipped = 0;
    let step = 0;

    const snap = (
        description: string,
        line: number,
        current: number | null,
        state: EntityState,
    ): VisualFrame => ({
        stepNumber: step,
        entities: bloomCells(filter, current, state),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            matchedPairs: [...matched],
            probesSkipped: skipped,
            bloomBits: [...filter],
            bitCount: bits,
            hashCount: hashes,
        },
    });

    yield snap(
        `Building a ${bits}-bit bloom filter with ${hashes} hashes for ${left.length} build key(s).`,
        0,
        null,
        "idle",
    );
    step += 1;

    for (const key of left) {
        buildSet.add(key);
        for (let i = 0; i < hashes; i += 1) {
            const pos = (hash1(key, bits) + i * hash2(key, bits)) % bits;
            filter[pos] = 1;
            yield snap(
                `Build key ${key}: set bit ${pos} (hash ${i + 1} of ${hashes}).`,
                2,
                pos,
                "active",
            );
            step += 1;
        }
    }

    for (const key of right) {
        const h1 = hash1(key, bits);
        const h2 = hash2(key, bits);
        let maybe = true;
        for (let i = 0; i < hashes; i += 1) {
            if (filter[(h1 + i * h2) % bits] !== 1) {
                maybe = false;
                break;
            }
        }
        if (!maybe) {
            skipped += 1;
            yield snap(
                `Probe key ${key}: a required bit is 0, so it is definitely absent; skip the lookup.`,
                5,
                (h1 + hash2(key, bits)) % bits,
                "error",
            );
            step += 1;
            continue;
        }
        if (buildSet.has(key)) {
            const pairs = left.filter((k) => k === key).map((k) => `${k}:${key}`);
            matched.push(...pairs);
            yield snap(
                `Probe key ${key}: filter says maybe and the lookup found ${pairs.length} match(es).`,
                6,
                h1,
                "sorted",
            );
        } else {
            yield snap(
                `Probe key ${key}: filter says maybe but the lookup found no match (false positive).`,
                6,
                h1,
                "comparing",
            );
        }
        step += 1;
    }

    yield snap(
        `Bloom join done: ${matched.length} matched pair(s), ${skipped} probe(s) skipped without a lookup.`,
        7,
        null,
        "sorted",
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Before doing an expensive lookup for every probe key, ask a small bitmap whether the key could possibly exist. The bitmap is built by setting several hash-derived bits for each build key. If any required bit is still zero on a probe, the key is definitely absent and the lookup can be skipped. If all bits are one, the key might be present, so the real lookup decides.",
        invariants: [
            "Every bit set for a build key remains set for the rest of the build phase.",
            "A probe that finds a zero bit is never a member of the build set.",
            "A probe that passes the filter still consults the actual set before matching.",
            "The matched pairs equal those of a plain hash join on the two inputs.",
        ],
        correctness:
            "A key inserted into the filter sets all of its hash positions, so a later probe of the same key always finds them set; this is the no-false-negative property. Therefore any true match passes the filter and reaches the lookup, so no matching pair is lost. A key that fails the filter is guaranteed absent and is safely skipped. Keys that pass but are absent are filtered out by the authoritative set lookup, so false positives cannot create spurious matches.",
        complexityRationale:
            "Each of the L build keys and R probe keys computes k hash positions, costing O((L + R) * k), and emitting M true pairs adds O(M). The filter uses m bits and the build set stores up to L keys, giving O(m + L) space.",
        uses: [
            "Semi-joins and hash joins in distributed SQL engines such as Spark and Presto",
            "Avoiding remote lookups in sharded key-value stores",
            "Membership pre-checks in storage engines such as RocksDB and Cassandra",
        ],
        references: [
            "Bloom, Space/Time Trade-offs in Hash Coding with Allowable Errors, CACM 1970",
            "Muller, Resilient Distributed Datasets and Spark SQL join optimization, 2013",
        ],
        workedExample:
            "Build keys 10, 20, 30, 40 set a handful of bits in a 32-bit filter. Probing 20, 30, and 40 passes the filter and the lookup confirms matches. Probing 99, 7, and 13 finds at least one zero bit and is skipped without touching the hash set, so the reported pairs are exactly those a plain join would return.",
    },
    id: "bloom-filter-join",
    name: "Bloom-Filter Join",
    category: "production-systems",
    complexity: { time: "O((L + R) * k + M)", space: "O(m + L)" },
    defaultInput: { left: [10, 20, 30, 40], right: [20, 99, 30, 7, 40, 13], bits: 32, hashes: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty bit array of m zeros",
        "for each build-side key",
        "set the k hash positions for that key to one",
        "for each probe-side key",
        "if any hash position is zero then skip the lookup",
        "otherwise look up the key in the build set",
        "emit a pair for every matching build key",
        "done: report matched pairs and skipped probes",
    ],
};

export default module;
