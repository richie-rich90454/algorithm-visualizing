/**
 * hash-join.ts - Grace Hash Join with Recursive Repartitioning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A hash join partitions the build and probe relations by a hash of the join
 * key, then builds an in-memory hash table for each build partition and probes
 * it with the matching probe partition. When a build partition exceeds capacity,
 * that bucket is repartitioned with a different hash salt and joined recursively.
 * Every build row matches every probe row with the same key.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(|build| + |probe|) expected per partitioning level
 *   Space: O(|build| + |probe|) for the buckets and hash tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show build bucket sizes; labels include the probe bucket size.
 *   - The bucket being joined is yellow; emitted matches are green.
 *   - The final frame reports the number of matching row pairs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Row {
    key: number;
    value: number;
}

interface HashJoinInput {
    build?: Row[];
    probe?: Row[];
    partitions?: number;
    capacity?: number;
}

function makeBars(build: number[], probe: number[], current: number, done: boolean): VisualEntity[] {
    return build.map((count, index) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (index === current) state = "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `bucket ${index}: build ${count}, probe ${probe[index] ?? 0}`,
            value: count,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, build: count, probe: probe[index] ?? 0 },
        };
    });
}

/** Mix a key with a level-dependent salt and return a bucket index. */
function bucketOf(key: number, level: number, mask: number): number {
    const salt = Math.imul(level + 1, 0x9e3779b1) >>> 0;
    let mixed = (Math.imul(key >>> 0, 0x85ebca6b) + salt) >>> 0;
    mixed ^= mixed >>> 13;
    mixed = Math.imul(mixed, 0xc2b2ae35) >>> 0;
    mixed ^= mixed >>> 16;
    return (mixed >>> 0) & mask;
}

/** The grace hash join generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HashJoinInput | null) ?? {};
    const toRows = (value: unknown): Row[] => Array.isArray(value)
        ? value
            .filter((row) => row && typeof row === "object")
            .map((row) => ({ key: Math.floor(Number((row as Row).key) || 0), value: Math.floor(Number((row as Row).value) || 0) }))
        : [];
    const build = toRows(task.build).length > 0
        ? toRows(task.build)
        : [{ key: 1, value: 10 }, { key: 2, value: 20 }, { key: 2, value: 21 }, { key: 3, value: 30 }, { key: 3, value: 31 }, { key: 3, value: 32 }];
    const probe = toRows(task.probe).length > 0
        ? toRows(task.probe)
        : [{ key: 2, value: 200 }, { key: 3, value: 300 }, { key: 4, value: 400 }, { key: 3, value: 301 }];
    const rawPartitions = typeof task.partitions === "number" ? Math.floor(task.partitions) : 4;
    let partitions = 2;
    while (partitions < Math.min(16, Math.max(2, rawPartitions))) partitions *= 2;
    const mask = partitions - 1;
    const capacity = typeof task.capacity === "number" ? Math.max(1, Math.floor(task.capacity)) : 3;
    const maxDepth = 5;

    const matches: number[] = [];
    const matchLabels: string[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(new Array<number>(partitions).fill(0), new Array<number>(partitions).fill(0), -1, false),
        edges: [],
        description: `Grace hash join: partitioning ${build.length} build and ${probe.length} probe rows into ${partitions} buckets.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { partitions, capacity, buildCount: build.length, probeCount: probe.length, matches: [], matchLabels: [], bucketBuild: new Array<number>(partitions).fill(0), bucketProbe: new Array<number>(partitions).fill(0), currentBucket: -1, level: 0, complete: false },
    };
    step += 1;

    const buildBuckets: Row[][] = Array.from({ length: partitions }, () => []);
    const probeBuckets: Row[][] = Array.from({ length: partitions }, () => []);
    for (const row of build) (buildBuckets[bucketOf(row.key, 0, mask)] as Row[]).push(row);
    for (const row of probe) (probeBuckets[bucketOf(row.key, 0, mask)] as Row[]).push(row);
    const buildSizes = buildBuckets.map((bucket) => bucket.length);
    const probeSizes = probeBuckets.map((bucket) => bucket.length);

    yield {
        stepNumber: step,
        entities: makeBars(buildSizes, probeSizes, -1, false),
        edges: [],
        description: `Partitioned rows: build sizes [${buildSizes.join(", ")}], probe sizes [${probeSizes.join(", ")}].`,
        codeLineNumber: 2,
        layout: "array",
        meta: { partitions, capacity, buildCount: build.length, probeCount: probe.length, matches: [], matchLabels: [], bucketBuild: buildSizes, bucketProbe: probeSizes, currentBucket: -1, level: 0, complete: false },
    };
    step += 1;

    const joinBucket = function* (buildRows: Row[], probeRows: Row[], level: number): Generator<VisualFrame, void, unknown> {
        if (buildRows.length <= capacity || level >= maxDepth) {
            const table = new Map<number, number[]>();
            for (const row of buildRows) {
                const list = table.get(row.key) ?? [];
                list.push(row.value);
                table.set(row.key, list);
            }
            for (const row of probeRows) {
                for (const value of table.get(row.key) ?? []) {
                    matches.push(row.key, value, row.key, row.value);
                    matchLabels.push(`(${row.key},${value}) x (${row.key},${row.value})`);
                }
            }
            return;
        }
        const subBuild: Row[][] = Array.from({ length: partitions }, () => []);
        const subProbe: Row[][] = Array.from({ length: partitions }, () => []);
        for (const row of buildRows) (subBuild[bucketOf(row.key, level, mask)] as Row[]).push(row);
        for (const row of probeRows) (subProbe[bucketOf(row.key, level, mask)] as Row[]).push(row);
        for (let i = 0; i < partitions; i += 1) {
            if ((subBuild[i] as Row[]).length === 0 && (subProbe[i] as Row[]).length === 0) continue;
            yield {
                stepNumber: step,
                entities: makeBars(subBuild.map((b) => b.length), subProbe.map((b) => b.length), i, false),
                edges: [],
                description: `Build bucket too large; repartitioning at level ${level} into ${partitions} sub-buckets, joining sub-bucket ${i}.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { partitions, capacity, buildCount: build.length, probeCount: probe.length, matches: [...matches], matchLabels: [...matchLabels], bucketBuild: subBuild.map((b) => b.length), bucketProbe: subProbe.map((b) => b.length), currentBucket: i, level, complete: false },
            };
            step += 1;
            yield* joinBucket(subBuild[i] as Row[], subProbe[i] as Row[], level + 1);
        }
    };

    for (let i = 0; i < partitions; i += 1) {
        const buildRows = buildBuckets[i] as Row[];
        const probeRows = probeBuckets[i] as Row[];
        const before = matchLabels.length;
        yield* joinBucket(buildRows, probeRows, 0);
        yield {
            stepNumber: step,
            entities: makeBars(buildSizes, probeSizes, i, false),
            edges: [],
            description: `Joined bucket ${i}: ${buildRows.length} build and ${probeRows.length} probe rows produced ${matchLabels.length - before} matches.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { partitions, capacity, buildCount: build.length, probeCount: probe.length, matches: [...matches], matchLabels: [...matchLabels], bucketBuild: buildSizes, bucketProbe: probeSizes, currentBucket: i, level: 0, complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(buildSizes, probeSizes, -1, true),
        edges: [],
        description: `Hash join complete: ${matchLabels.length} matching row pair(s) across all buckets.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { partitions, capacity, buildCount: build.length, probeCount: probe.length, matches, matchLabels, bucketBuild: buildSizes, bucketProbe: probeSizes, currentBucket: -1, level: 0, complete: true },
    };
}

/** The hash join module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of comparing every build row with every probe row, a hash join sends rows with the same key to the same bucket. Within a bucket the smaller side becomes a hash table and the other side probes it. If one bucket is still too big to fit in memory, hash it again with a different salt until it does.",
        invariants: [
            "The hash sends equal keys to the same bucket at every level.",
            "Partitioning preserves every input row exactly once.",
            "A probe row matches every build row whose key equals its own.",
            "Recursive repartitioning applies only to oversized build buckets.",
        ],
        correctness:
            "The hash function is deterministic, so two rows with equal keys always land in the same bucket at every level and can never be separated. Rows with different keys may collide but are distinguished by the in-bucket hash table, which indexes exact keys. Probing that table emits exactly the pairs with equal keys, matching a nested-loop join, and repartitioning merely splits one bucket into disjoint sub-buckets without changing which rows share a key.",
        complexityRationale:
            "Partitioning scans both relations once per level, and building and probing hash tables is linear in bucket sizes, so expected work is O(build plus probe) per level. Buckets and hash tables hold each row once, giving O(build plus probe) space.",
        uses: [
            "Equi-joins in analytical query engines",
            "Partitioned joins in parallel data processing frameworks",
            "Building column-store join operators",
        ],
        references: [
            "Kitsuregawa, Tanaka, and Mogi, Application of Hash to Data Base Machine, 1983",
            "Garcia-Molina, Ullman, and Widom, Database Systems: The Complete Book, Chapter 14",
        ],
        workedExample:
            "Build rows (2,20) and (2,21) hash to the same bucket as probe row (2,200). The hash table maps key 2 to the list 20 and 21, so probing emits (2,20) joined with (2,200) and (2,21) joined with (2,200). A probe row with key 4 finds no build rows and emits nothing.",
    },
    id: "hash-join",
    name: "Hash Join",
    category: "production-systems",
    complexity: { time: "O(|build| + |probe|) per level", space: "O(|build| + |probe|)" },
    defaultInput: {
        build: [
            { key: 1, value: 10 },
            { key: 2, value: 20 },
            { key: 2, value: 21 },
            { key: 3, value: 30 },
            { key: 3, value: 31 },
            { key: 3, value: 32 },
        ],
        probe: [
            { key: 2, value: 200 },
            { key: 3, value: 300 },
            { key: 4, value: 400 },
            { key: 3, value: 301 },
        ],
        partitions: 4,
        capacity: 3,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the build and probe rows and the bucket count",
        "hash each row by key into build and probe buckets",
        "for each bucket pair run the join recursively",
        "if the build bucket exceeds capacity repartition with a new salt",
        "otherwise index build rows by key in a hash table",
        "probe the table and emit every matching row pair",
        "done: report the total number of joined pairs",
    ],
};

export default module;
