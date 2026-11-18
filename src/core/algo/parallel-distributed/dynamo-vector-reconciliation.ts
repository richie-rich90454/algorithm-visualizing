/**
 * dynamo-vector-reconciliation.ts - Dynamo Vector Clock Reconciliation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dynamo-style stores attach a vector clock to each version of a key. When two
 * replicas sync, reconciliation compares the vectors component by component.
 * If one vector dominates the other its value wins; if neither dominates, the
 * writes were concurrent and the store resolves them, here by last writer
 * wins. This module shows that decision on a small two-replica example.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) to compare two r-component vectors
 *   Space: O(r) for the resolved vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A three-row grid shows replica A, replica B, and the resolved vector.
 *   - The compared components turn yellow in the compare frame.
 *   - The resolved row turns green when reconciliation finishes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Version {
    vector: number[];
    value: string;
    timestamp: number;
}

/** Return -1 if a dominates b, 1 if b dominates a, 0 if concurrent or equal. */
function compareVectors(a: number[], b: number[]): number {
    let aDominates = false;
    let bDominates = false;
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        if (av > bv) {
            aDominates = true;
        } else if (bv > av) {
            bDominates = true;
        }
    }
    if (aDominates && !bDominates) {
        return -1;
    }
    if (bDominates && !aDominates) {
        return 1;
    }
    return 0;
}

/** Build the three-row vector grid; mark the resolved row when done. */
function makeCells(a: Version, b: Version, resolved: number[], done: boolean, active: boolean): VisualEntity[] {
    const rows = [a.vector, b.vector, resolved];
    const labels = ["A", "B", "R"];
    const entities: VisualEntity[] = [];
    for (let r = 0; r < 3; r += 1) {
        const row = rows[r] ?? [];
        for (let c = 0; c < Math.max(1, row.length); c += 1) {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(row[c] ?? 0),
                value: row[c] ?? 0,
                state: r === 2
                    ? (done ? "sorted" : "unvisited")
                    : (active && r < 2 ? "comparing" : "idle"),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, replica: labels[r] ?? "" },
            });
        }
    }
    return entities;
}

/** The Dynamo vector-clock reconciliation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { aVector?: number[]; bVector?: number[]; aValue?: string; bValue?: string; aTime?: number; bTime?: number } | null
    ) ?? {};
    const a: Version = {
        vector: Array.isArray(task.aVector) ? task.aVector.map((v) => Math.max(0, Math.trunc(Number(v) || 0))) : [2, 1],
        value: typeof task.aValue === "string" ? task.aValue : "red",
        timestamp: typeof task.aTime === "number" ? task.aTime : 10,
    };
    const b: Version = {
        vector: Array.isArray(task.bVector) ? task.bVector.map((v) => Math.max(0, Math.trunc(Number(v) || 0))) : [1, 2],
        value: typeof task.bValue === "string" ? task.bValue : "blue",
        timestamp: typeof task.bTime === "number" ? task.bTime : 20,
    };
    const order = compareVectors(a.vector, b.vector);
    let relationship: string;
    let winner: Version;
    if (order === -1) {
        relationship = "a-dominates";
        winner = a;
    } else if (order === 1) {
        relationship = "b-dominates";
        winner = b;
    } else if (a.vector.every((v, i) => v === (b.vector[i] ?? 0))) {
        relationship = "equal";
        winner = a.timestamp >= b.timestamp ? a : b;
    } else {
        relationship = "concurrent";
        winner = a.timestamp >= b.timestamp ? a : b;
    }
    const resolved = winner.vector.map((v, i) => Math.max(v, b.vector[i] ?? 0, a.vector[i] ?? 0));
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeCells(a, b, resolved, false, false),
        edges: [],
        description: `Reconcile two versions: A=${a.value}, B=${b.value} with ${a.vector.length} clock component(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 3,
            cols: Math.max(1, a.vector.length),
            aVector: [...a.vector],
            bVector: [...b.vector],
            resolvedVector: resolved,
            relationship: "pending",
            winner: "pending",
        },
    };
    frame += 1;

    yield {
        stepNumber: frame,
        entities: makeCells(a, b, resolved, false, true),
        edges: [],
        description: "Compare the two vector clocks component by component.",
        codeLineNumber: 2,
        layout: "grid",
        meta: {
            rows: 3,
            cols: Math.max(1, a.vector.length),
            aVector: [...a.vector],
            bVector: [...b.vector],
            resolvedVector: resolved,
            relationship: "pending",
            winner: "pending",
        },
    };
    frame += 1;

    yield {
        stepNumber: frame,
        entities: makeCells(a, b, resolved, false, false),
        edges: [],
        description: `Relationship is ${relationship.replace("-", " ")}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 3,
            cols: Math.max(1, a.vector.length),
            aVector: [...a.vector],
            bVector: [...b.vector],
            resolvedVector: resolved,
            relationship,
            winner: "pending",
        },
    };
    frame += 1;

    yield {
        stepNumber: frame,
        entities: makeCells(a, b, resolved, true, false),
        edges: [],
        description: `Reconciled value is "${winner.value}" (timestamp ${winner.timestamp}).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 3,
            cols: Math.max(1, a.vector.length),
            aVector: [...a.vector],
            bVector: [...b.vector],
            resolvedVector: resolved,
            relationship,
            winner: winner.value,
        },
    };
}

/** The Dynamo vector-clock reconciliation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A vector clock remembers how many writes each replica has seen. If one clock is at least as large as the other in every component it happened later and wins. If the two clocks cross over, the writes were concurrent, so the store falls back to a deterministic rule such as last writer wins.",
        invariants: [
            "A dominating write always supersedes a dominated one.",
            "Concurrent writes are resolved by a deterministic tie-break.",
            "The resolved clock is the componentwise maximum of the two clocks.",
        ],
        correctness:
            "Componentwise comparison decides the happens-before relation: a dominates b exactly when every component of a is at least the matching component of b and one is strictly larger. A dominating write is causally later, so discarding the dominated one is safe. When neither dominates, the writes are concurrent and any deterministic total order, here the timestamp followed by the stored value, gives all replicas the same winner, which is the convergence requirement.",
        complexityRationale:
            "Comparing two r-component vectors scans each component once, so O(r) time. The merged vector and the row grid also use O(r) space.",
        uses: [
            "Conflict resolution in eventually consistent key-value stores",
            "Detecting concurrent edits in collaborative systems",
            "Merging replicated data with causal metadata",
        ],
        references: [
            "DeCandia et al., Dynamo: Amazon's Highly Available Key-Value Store, 2007",
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, 1978",
        ],
        workedExample:
            "Version A is (2,1) with value red at time 10 and version B is (1,2) with value blue at time 20. Neither dominates, so the writes are concurrent and last writer wins chooses blue. The resolved clock is (2,2).",
    },
    id: "dynamo-vector-reconciliation",
    name: "Dynamo Vector Reconciliation",
    category: "parallel-distributed",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: {
        aVector: [2, 1],
        bVector: [1, 2],
        aValue: "red",
        bValue: "blue",
        aTime: 10,
        bTime: 20,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "load the two version vectors and timestamps",
        "for each component compare the two entries",
        "if one vector dominates choose its version",
        "otherwise mark the writes as concurrent",
        "break the tie by the larger timestamp",
        "set the resolved clock to componentwise maxima",
        "store the winning value with that clock",
        "done: report the reconciled version",
    ],
};

export default module;
