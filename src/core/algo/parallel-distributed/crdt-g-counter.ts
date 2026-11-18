/**
 * crdt-g-counter.ts - Grow-Only Counter CRDT
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A grow-only counter is a conflict-free replicated data type. Each replica
 * owns one component of a vector and only ever increments its own component.
 * The counter's value is the sum of the components, and merging two replicas
 * takes the componentwise maximum. Because maximum is commutative, associative,
 * and idempotent, replicas that exchange updates in any order converge to the
 * same state, and no coordinated lock is needed.
 *
 * This deterministic model gives each replica a fixed number of increments.
 * The exact step shown is the merge law: max(a, b) per component, which makes
 * every merge order and every duplicate delivery produce the same vector.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) per increment or merge for r replicas
 *   Space: O(r) for the component vector at each replica
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per replica shows that replica's component of the vector.
 *   - The component being incremented or merged is highlighted.
 *   - The final frame is green and reports the converged counter value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface GCounterData {
    replicas: number;
    updates: number[];
    localVectors: number[][];
    finalVector: number[];
    value: number;
    orders: number[][];
    idempotent: boolean;
}

/** Componentwise maximum, the G-counter merge law. */
export function mergeVector(a: number[], b: number[]): number[] {
    return a.map((value, i) => Math.max(value, b[i] ?? 0));
}

/** Deterministic G-counter simulation with several merge orders. */
export function simulateGCounter(updates: number[]): GCounterData {
    const r = Math.max(1, updates.length);
    const counts = updates.slice(0, r).map((value) => Math.max(0, Math.floor(value)));
    const localVectors = counts.map((value, i) =>
        Array.from({ length: r }, (_, j) => (j === i ? value : 0)),
    );
    const fold = (order: number[]): number[] => {
        let acc = Array<number>(r).fill(0);
        for (const i of order) {
            acc = mergeVector(acc, localVectors[i] ?? []);
        }
        return acc;
    };
    const orders = [
        fold(Array.from({ length: r }, (_, i) => i)),
        fold(Array.from({ length: r }, (_, i) => r - 1 - i)),
        fold(Array.from({ length: r }, (_, i) => (i + Math.floor(r / 2)) % r)),
    ];
    const finalVector = orders[0] ?? [];
    const idempotent = mergeVector(finalVector, finalVector).every((v, i) => v === finalVector[i]);
    return {
        replicas: r,
        updates: counts,
        localVectors,
        finalVector,
        value: counts.reduce((a, b) => a + b, 0),
        orders,
        idempotent,
    };
}

/** Build the component bars for the current vector. */
function makeBars(vector: number[], active: Set<number>, state: EntityState = "idle"): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: active.has(index) ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, replica: index },
    }));
}

/** The G-counter generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { updates?: number[] } | null) ?? {};
    const updates = Array.isArray(task.updates) && task.updates.length > 0 ? [...task.updates] : [3, 5, 2];
    const data = simulateGCounter(updates);
    const r = data.replicas;

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(Array<number>(r).fill(0), new Set()),
        edges: [],
        description: `G-counter with ${r} replicas; each increments only its own component, value is their sum.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { replicas: r, value: 0, vector: Array<number>(r).fill(0), phase: "setup" },
    };

    for (let i = 0; i < r; i += 1) {
        const vector = data.localVectors[i] ?? [];
        yield {
            stepNumber: step++,
            entities: makeBars(vector, new Set([i])),
            edges: [],
            description: `Replica ${i} increments its own component to ${data.updates[i]} (value ${data.updates[i]}).`,
            codeLineNumber: 2,
            layout: "array",
            meta: { replicas: r, value: data.updates[i] ?? 0, vector: [...vector], phase: "increment", replica: i },
        };
    }

    let acc = Array<number>(r).fill(0);
    for (let i = 0; i < r; i += 1) {
        acc = mergeVector(acc, data.localVectors[i] ?? []);
        yield {
            stepNumber: step++,
            entities: makeBars(acc, new Set([i])),
            edges: [],
            description: `Merge replica ${i}: componentwise maximum gives vector [${acc.join(", ")}].`,
            codeLineNumber: 4,
            layout: "array",
            meta: { replicas: r, value: acc.reduce((a, b) => a + b, 0), vector: [...acc], phase: "merge", replica: i },
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(data.finalVector, new Set(), "sorted"),
        edges: [],
        description: `Converged: every merge order gives [${data.finalVector.join(", ")}] with counter value ${data.value}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            replicas: r,
            value: data.value,
            vector: [...data.finalVector],
            phase: "done",
            converged: data.orders.every((o) => o.every((v, i) => v === data.finalVector[i])),
        },
    };
}

/** The G-counter module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every replica its own slot in a vector and let it only increase that slot. To find the total, add the slots. When replicas synchronize they simply take the larger of each pair of slots. Since taking a maximum does not care about order or repetition, messages can arrive late, out of order, or twice and the result is still the same.",
        invariants: [
            "A replica only ever writes to its own component, so components never decrease.",
            "Merging is the componentwise maximum of the two vectors.",
            "The counter value equals the sum of all components at every point.",
        ],
        correctness:
            "Maximum on numbers is commutative, associative, and idempotent, so the componentwise merge has all three properties. Any delivery order of the same set of increments folds to the same vector, and re-delivering a vector (idempotence) changes nothing. Because each increment touches exactly one component, the merged component i equals replica i's total increment count, and the sum is the true total, so all replicas converge to the correct value.",
        complexityRationale:
            "An increment writes one component, O(1), and a merge compares r components, O(r). Each replica stores an r-entry vector, so the space is O(r) per replica.",
        uses: [
            "Distributed like counts and event totals",
            "Metrics aggregation across nodes that reconcile later",
            "Offline-first applications that sync on reconnect",
        ],
        references: [
            "Shapiro, Preguica, Baquero, and Zawirski, Conflict-Free Replicated Data Types, 2011",
            "Preguica et al., A Commutative Replicated Data Type for Cooperative Editing, 2009",
        ],
        workedExample:
            "Three replicas increment 3, 5, and 2 times. Their local vectors are [3,0,0], [0,5,0], and [0,0,2]. Merging in any order yields [3,5,2] with value 10, and merging that vector with itself leaves it unchanged.",
    },
    id: "crdt-g-counter",
    name: "CRDT G-Counter",
    category: "parallel-distributed",
    complexity: { time: "O(r) per merge", space: "O(r)" },
    defaultInput: { updates: [3, 5, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "give each replica one component initialized to zero",
        "to increment, a replica raises only its own component",
        "to merge two replicas, take the maximum of each component",
        "exchange state with peers in any order",
        "repeated delivery of the same state changes nothing",
        "the counter value is the sum of the components",
        "done: all replicas converge to the same vector",
    ],
};

export default module;
