/**
 * read-one-write-all.ts - Read-One-Write-All Replication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The simplest replicated-register protocol writes every value to all replicas
 * and answers a read from any single replica. A write commits only when all
 * replicas are reachable, which keeps every replica identical after each
 * successful write. A read tolerates a down replica by trying the next one.
 * The scheme favors strong consistency over write availability.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) messages for a write to n replicas, O(1) for a read attempt
 *   Space: O(n) for the replica values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each replica is a node; the coordinator connects to it with an edge.
 *   - A freshly written replica is green, a failed one is red, a read is yellow.
 *   - The final frame reports the committed value and replica agreement.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Operation {
    op: "write" | "read";
    value?: number;
    down?: number[];
}

function makeNodes(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, i) => ({
        id: `replica-${i}`,
        type: "node" as const,
        label: String(value),
        value,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { role: "replica", index: i, value },
    }));
}

function makeEdges(n: number, state: EntityState, label: string): VisualEdge[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `edge-${i}`,
        sourceId: "coordinator",
        targetId: `replica-${i}`,
        label,
        state,
        directed: true,
    }));
}

function allNodes(n: number, values: number[], state: EntityState): VisualEntity[] {
    return [
        { id: "coordinator", type: "node", label: "C", value: "coordinator", state: "active", x: 0, y: 0, width: 0, height: 0, metadata: { role: "coordinator" } },
        ...makeNodes(values, Array.from({ length: n }, () => state)),
    ];
}

/** Read-one-write-all generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { replicas?: number; operations?: Operation[] } | null) ?? {};
    const n = typeof task.replicas === "number" && Number.isFinite(task.replicas)
        ? Math.max(2, Math.min(6, Math.floor(task.replicas)))
        : 3;
    const operations: Operation[] = Array.isArray(task.operations) && task.operations.length > 0
        ? task.operations
        : [
              { op: "write", value: 5 },
              { op: "read" },
              { op: "write", value: 9, down: [1] },
              { op: "read" },
          ];

    const values = new Array<number>(n).fill(0);
    let committed = 0;
    const results: Array<number | null> = [];
    let step = 0;

    const meta = (opIndex: number, phase: string, done: boolean) => ({
        replicas: n,
        operations: operations.length,
        opIndex,
        committed,
        values: [...values],
        agree: values.every((v) => v === values[0]),
        results: results.map((r) => (r === null ? "unavailable" : r)),
        phase,
        done,
        step,
    });

    yield {
        stepNumber: step,
        entities: allNodes(n, values, "idle"),
        edges: makeEdges(n, "idle", "-"),
        description: `ROWA replication over ${n} replicas with ${operations.length} operations.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: meta(-1, "setup", false),
    };
    step += 1;

    for (let i = 0; i < operations.length; i += 1) {
        const operation = operations[i]!;
        const down = new Set(operation.down ?? []);
        if (operation.op === "write") {
            const reachable = Array.from({ length: n }, (_, r) => !down.has(r));
            const success = reachable.every(Boolean);
            const states: EntityState[] = reachable.map((ok, r) => (ok ? (success ? "sorted" : "comparing") : "error"));
            if (success) {
                const value = operation.value ?? 0;
                for (let r = 0; r < n; r += 1) values[r] = value;
                committed = value;
            }
            yield {
                stepNumber: step,
                entities: [allNodes(n, values, "idle")[0]!, ...makeNodes(values, states)],
                edges: makeEdges(n, success ? "sorted" : "error", success ? "write" : "abort"),
                description: success
                    ? `Write ${operation.value ?? 0} reached all ${n} replicas and committed.`
                    : `Write aborted: ${down.size} replica(s) unreachable, so no value committed.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: meta(i, "write", false),
            };
            step += 1;
        } else {
            const order = Array.from({ length: n }, (_, r) => r).sort((a, b) => (down.has(a) ? 1 : 0) - (down.has(b) ? 1 : 0) + a - b);
            const chosen = order.find((r) => !down.has(r));
            const result = chosen === undefined ? null : (values[chosen] ?? 0);
            results.push(result);
            const states: EntityState[] = values.map((_, r) => (r === chosen ? "comparing" : down.has(r) ? "error" : "idle"));
            yield {
                stepNumber: step,
                entities: [allNodes(n, values, "idle")[0]!, ...makeNodes(values, states)],
                edges: makeEdges(n, chosen === undefined ? "error" : "comparing", chosen === undefined ? "unavailable" : `read ${result ?? "-"}`),
                description:
                    result === null
                        ? "Read failed: every replica is unreachable."
                        : `Read replica ${chosen} and returned ${result}.`,
                codeLineNumber: 4,
                layout: "graph",
                meta: meta(i, "read", false),
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: allNodes(n, values, values.every((v) => v === values[0]) ? "sorted" : "error"),
        edges: makeEdges(n, "sorted", "done"),
        description: `Final committed value ${committed}; replica agreement is ${meta(step, "done", true).agree}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: meta(operations.length, "done", true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep every copy identical by writing the new value to all of them and reading from whichever one answers first. Writes are strict: if even one replica is down the write is abandoned, so the replicas never diverge. Reads are lenient and try another copy if the first is unavailable. This trades write availability for a very simple form of strong consistency.",
        invariants: [
            "After every successful write all reachable-by-definition replicas hold the committed value.",
            "An aborted write changes no replica, so disagreement never arises.",
            "A read returns the value held by exactly one replica, never a mixture.",
        ],
        correctness:
            "Induct on the operation sequence. Initially all replicas agree. A write proceeds only when every replica is reachable and then assigns the same value to all, preserving agreement. An aborted write assigns nothing, also preserving agreement. A read returns a stored value without modifying any replica. Therefore agreement holds after every operation, and any read after a committed write returns that write's value.",
        complexityRationale:
            "A write sends the value to all n replicas, O(n) messages, and waits for all of them. A read contacts replicas until one answers, O(n) in the worst case. Each replica stores one value, O(n) space in total.",
        uses: [
            "Configuration and metadata stores with small replica counts",
            "Teaching the consistency versus availability trade-off",
            "Systems where writes are rare and reads must be strongly consistent",
        ],
        references: [
            "Gilbert and Lynch, Brewer's Conjecture and the Feasibility of Consistent Available Partition-Tolerant Web Services, 2002",
            "Tanenbaum and van Steen, Distributed Systems, chapter on replication",
        ],
        workedExample:
            "With three replicas, writing 5 reaches all three and commits. A later write of 9 while replica one is down is aborted, leaving all replicas at 5. A read then consults replica zero and returns 5, so clients never observe a partial write.",
    },
    id: "read-one-write-all",
    name: "Read-One-Write-All Replication",
    category: "parallel-distributed",
    complexity: { time: "O(n) per operation", space: "O(n)" },
    defaultInput: { replicas: 3 },
    visualType: "graph",
    run,
    pseudocode: [
        "keep a value at each of the n replicas",
        "on a write, check that every replica is reachable",
        "if all are reachable, write the value to all and commit",
        "otherwise abort the write and leave every replica unchanged",
        "on a read, try replicas until one responds",
        "return the value held by that single replica",
        "done: all replicas agree on the last committed value",
    ],
};

export default module;
