/**
 * quorum-read-write.ts - Quorum Read/Write Replication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A replicated store keeps N copies of a value. A write succeeds once W copies
 * acknowledge it, and a read consults R copies and takes the most recent value
 * it finds. If R + W is greater than N, any read set must overlap any write
 * set in at least one copy, so a read always sees the latest completed write.
 * This is the quorum intersection rule used by Dynamo-style stores.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(W) messages per write and O(R) per read
 *   Space: O(N) for the replica versions and values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Replicas are cells showing their current value and version.
 *   - Replicas reached by a write turn yellow, then green when current.
 *   - The read frame highlights the R queried replicas and the newest one.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    versions: number[],
    values: Array<number | null>,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return versions.map((version, index) => ({
        id: `replica-${index}`,
        type: "cell" as const,
        label: values[index] === null ? "-:0" : `${values[index]}:${version}`,
        value: values[index] ?? 0,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, version, value: values[index] ?? 0 },
    }));
}

/** Deterministic subset of `size` replicas, rotated by `rotation`. */
function subset(n: number, size: number, rotation: number): number[] {
    const count = Math.min(n, Math.max(0, size));
    const result: number[] = [];
    for (let j = 0; j < count; j += 1) result.push((rotation + j) % n);
    return result;
}

/** Quorum read/write generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            replicas?: number;
            writeQuorum?: number;
            readQuorum?: number;
            writes?: number[];
        } | null
    ) ?? {};
    const n = typeof task.replicas === "number" ? Math.max(1, Math.floor(task.replicas)) : 5;
    const w =
        typeof task.writeQuorum === "number"
            ? Math.min(n, Math.max(1, Math.floor(task.writeQuorum)))
            : 3;
    const r =
        typeof task.readQuorum === "number"
            ? Math.min(n, Math.max(1, Math.floor(task.readQuorum)))
            : 3;
    const writes = Array.isArray(task.writes) ? task.writes.map((value) => Number(value) || 0) : [10, 20, 30];
    const versions = new Array<number>(n).fill(0);
    const values = new Array<number | null>(n).fill(null);
    const guaranteed = r + w > n;
    let step = 0;
    let version = 0;

    const baseMeta = {
        rows: 1,
        cols: n,
        replicas: n,
        writeQuorum: w,
        readQuorum: r,
        guaranteed,
    };

    yield {
        stepNumber: step,
        entities: makeCells(versions, values),
        edges: [],
        description: `Starting ${n} replicas; writes touch ${w} and reads touch ${r}, so intersection is ${guaranteed ? "guaranteed" : "not guaranteed"}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, versions: [...versions], phase: "setup" },
    };
    step += 1;

    for (let i = 0; i < writes.length; i += 1) {
        const value = writes[i] ?? 0;
        version += 1;
        const targets = subset(n, w, i);
        const states = new Map<number, EntityState>();
        for (const index of targets) {
            versions[index] = version;
            values[index] = value;
            states.set(index, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeCells(versions, values, states),
            edges: [],
            description: `Write ${i + 1}: value ${value} at version ${version} is acknowledged by replicas ${targets.join(", ")}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...baseMeta, versions: [...versions], phase: "write", value, version, targets },
        };
        step += 1;
    }

    const queried = subset(n, r, writes.length);
    let bestVersion = -1;
    let bestValue: number | null = null;
    for (const index of queried) {
        const candidate = versions[index] ?? 0;
        if (candidate > bestVersion) {
            bestVersion = candidate;
            bestValue = values[index] ?? 0;
        }
    }
    const latestValue = writes.length > 0 ? writes[writes.length - 1] ?? 0 : 0;
    const readStates = new Map<number, EntityState>();
    for (const index of queried) {
        readStates.set(index, (versions[index] ?? 0) === bestVersion ? "sorted" : "comparing");
    }
    yield {
        stepNumber: step,
        entities: makeCells(versions, values, readStates),
        edges: [],
        description: `Read from replicas ${queried.join(", ")} returns value ${bestValue} at version ${bestVersion}${guaranteed ? ", matching the latest write" : ", which may be stale"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            ...baseMeta,
            versions: [...versions],
            phase: "read",
            queried,
            readVersion: bestVersion,
            readValue: bestValue ?? 0,
            latestValue,
            correct: bestValue === latestValue,
        },
    };
}

/** The quorum read/write module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Write to several copies and read from several copies. If the two groups are large enough that they must overlap, the read is guaranteed to meet at least one copy that saw the most recent write. It then picks the value with the highest version number, so stale copies cannot win.",
        invariants: [
            "A write updates exactly the W replicas in its quorum and bumps the version.",
            "A read considers only its R queried replicas and returns the highest version among them.",
            "Versions increase monotonically, so a larger version always means a newer value.",
        ],
        correctness:
            "Let a completed write touch W replicas and a later read touch R replicas out of N. When R + W > N the two sets cannot be disjoint, because their sizes would sum to more than N. At least one queried replica therefore holds the newest version. Since the read returns the maximum version it sees, and no version is newer than the latest write, the returned value equals the latest completed write.",
        complexityRationale:
            "A write exchanges one message with each of the W replicas and a read with each of the R replicas, so the per-operation message cost is O(W) or O(R). Storing a version and a value for each of the N replicas uses O(N) space.",
        uses: [
            "Tunable consistency in Dynamo and Cassandra",
            "Replicated registries in distributed key-value stores",
            "Availability and consistency trade-offs in NoSQL databases",
        ],
        references: [
            "DeCandia et al., Dynamo: Amazon's Highly Available Key-Value Store, 2007",
            "Lamport, The Part-Time Parliament, 1998 (majority intersection)",
        ],
        workedExample:
            "With five replicas, W = 3 and R = 3, a write reaches replicas 0, 1, 2. A read of replicas 2, 3, 4 still includes replica 2, sees the newest version, and returns the right value. With W = 2 and R = 2 a read of 2, 3 could miss the write on 0, 1 entirely.",
    },
    id: "quorum-read-write",
    name: "Quorum Read/Write",
    category: "parallel-distributed",
    complexity: { time: "O(W + R) messages", space: "O(N)" },
    defaultInput: { replicas: 5, writeQuorum: 3, readQuorum: 3, writes: [10, 20, 30] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize every replica with version zero and no value",
        "for each write increment the version number",
        "send the value to W replicas and wait for acknowledgments",
        "for a read query R replicas and collect their versions",
        "select the value with the largest version seen",
        "done: return that value, which is current when R plus W exceeds N",
    ],
};

export default module;
