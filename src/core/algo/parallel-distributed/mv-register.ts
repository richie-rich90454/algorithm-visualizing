/**
 * mv-register.ts - Multi-Value Register CRDT
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A multi-value register keeps every value written at the greatest timestamp
 * instead of picking a single winner. An assign replaces the whole state with
 * one tagged value; a concurrent assign at the same timestamp is preserved, so
 * simultaneous edits are all visible rather than one being silently lost. A
 * read returns the set of values carrying the maximum timestamp, ordered by
 * value for a deterministic answer at every replica.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(w + r^2 * c) for w writes, r replicas, c concurrent values
 *   Space: O(r * c) for the replica states
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cell shows a replica's current value set.
 *   - A replica being updated is yellow; after convergence it is green.
 *   - The meta reports the maximum timestamp and the merged value set.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MvInput {
    replicas?: number;
    writes?: Array<{ replica: number; value: number }>;
}

/** A state is the set of values attached to one Lamport timestamp. */
interface State {
    timestamp: number;
    values: number[];
}

/** Merge two states: keep the larger timestamp, or union values on a tie. */
function merge(left: State, right: State): State {
    if (left.timestamp > right.timestamp) return { timestamp: left.timestamp, values: [...left.values] };
    if (right.timestamp > left.timestamp) return { timestamp: right.timestamp, values: [...right.values] };
    const values = [...new Set([...left.values, ...right.values])].sort((a, b) => a - b);
    return { timestamp: left.timestamp, values };
}

function makeCells(states: State[], active: number, done: boolean): VisualEntity[] {
    return states.map((state, index) => ({
        id: `replica-${index}`,
        type: "cell" as const,
        label: state.values.length === 0 ? "-" : state.values.join(","),
        value: state.values.slice(),
        state: (
            done
                ? "sorted"
                : index === active
                  ? "comparing"
                  : state.values.length === 0
                    ? "idle"
                    : "visited"
        ) as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, timestamp: state.timestamp, count: state.values.length },
    }));
}

/** The multi-value register generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MvInput | null) ?? {};
    const replicas = typeof task.replicas === "number" && task.replicas >= 1 ? Math.floor(task.replicas) : 3;
    const writes: Array<{ replica: number; value: number }> =
        Array.isArray(task.writes) && task.writes.length > 0
            ? task.writes
                  .filter((w): w is { replica: number; value: number } =>
                      !!w && typeof w.replica === "number" && typeof w.value === "number")
                  .map((w) => ({ replica: ((Math.floor(w.replica) % replicas) + replicas) % replicas, value: w.value }))
            : [
                  { replica: 0, value: 7 },
                  { replica: 1, value: 7 },
                  { replica: 2, value: 3 },
              ];

    const states: State[] = Array.from({ length: replicas }, () => ({ timestamp: 0, values: [] }));
    let clock = 0;
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeCells(states, -1, false),
        edges: [],
        description: `Starting a multi-value register on ${replicas} replicas with ${writes.length} write(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: replicas, timestamp: 0, values: [] as number[], converged: false },
    };

    for (const write of writes) {
        clock += 1;
        states[write.replica] = { timestamp: clock, values: [write.value] };
        yield {
            stepNumber: step++,
            entities: makeCells(states, write.replica, false),
            edges: [],
            description: `Replica ${write.replica} assigns ${write.value} at timestamp ${clock}, replacing its set.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 1, cols: replicas, timestamp: clock, values: [write.value], converged: false, active: write.replica },
        };
    }

    for (let round = 0; round < replicas - 1; round += 1) {
        for (let index = 0; index < replicas; index += 1) {
            const target = (index + 1) % replicas;
            states[index] = merge(states[index]!, states[target]!);
            states[target] = states[index]!;
            const joined = merge(states[index]!, states[target]!);
            const view = joined.values;
            yield {
                stepNumber: step++,
                entities: makeCells(states, target, false),
                edges: [],
                description: `Merge replicas ${index} and ${target}; equal timestamps keep both values.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { rows: 1, cols: replicas, timestamp: joined.timestamp, values: view, converged: false, round: round + 1 },
            };
        }
    }

    let final = states[0]!;
    for (const state of states) {
        final = merge(final, state);
    }
    yield {
        stepNumber: step,
        entities: makeCells(states, -1, true),
        edges: [],
        description: `Converged to timestamp ${final.timestamp} with value set [${final.values.join(", ")}].`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 1, cols: replicas, timestamp: final.timestamp, values: final.values.slice(), converged: true },
    };
}

/** The multi-value register module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A last-writer-wins register throws away all but one concurrent edit. A multi-value register keeps every value stamped with the newest timestamp. When two replicas write at the same logical time, neither is 'later', so the merge unions their values; a genuinely later write has a bigger timestamp and wins outright. The read returns the whole winning set.",
        invariants: [
            "A state holds a single timestamp and a sorted set of values.",
            "Merging picks the larger timestamp, or unions values when timestamps tie.",
            "The final read returns only values at the maximum timestamp.",
            "Merge is associative, commutative, and idempotent.",
        ],
        correctness:
            "Merge is the join of a semilattice: the timestamp comparison is total and value sets union on ties. Associativity, commutativity, and idempotence mean every replica that has seen the same writes computes the same join, regardless of message order or duplication. Since an assign replaces the state with a fresh, larger timestamp, the join at that timestamp is exactly the set of values written concurrently, so the read is the correct multi-value answer.",
        complexityRationale:
            "Each of the w writes is O(1). A full anti-entropy sweep performs O(r^2) pair merges, each sorting at most c concurrent values, giving O(w + r^2 * c) time and O(r * c) space across the replicas.",
        uses: [
            "Collaborative calendars where simultaneous edits must all survive",
            "Shopping carts that merge concurrent additions",
            "Offline-first note taking without silent data loss",
        ],
        references: [
            "Shapiro et al., A Comprehensive Study of Convergent and Commutative Replicated Data Types, 2011",
            "Preguica et al., A Simple and Robust Conflict-Free Replicated Object, 2009",
        ],
        workedExample:
            "Three replicas each assign value 7 at timestamp 1. Merging keeps timestamp 1 and the union {7}, so the read is {7}. If replica 0 assigns 7 and replica 1 assigns 9 both at timestamp 1, the merged read is {7, 9}; a later write of 4 at timestamp 2 then reduces the read to {4}.",
    },
    id: "mv-register",
    name: "Multi-Value Register CRDT",
    category: "parallel-distributed",
    complexity: { time: "O(w + r^2 * c)", space: "O(r * c)" },
    defaultInput: {
        replicas: 3,
        writes: [
            { replica: 0, value: 7 },
            { replica: 1, value: 9 },
            { replica: 2, value: 3 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize every replica to an empty state",
        "on assign increment the logical clock at the writer",
        "replace its state with the value tagged by that clock",
        "for each pair of replicas in an anti-entropy pass",
        "keep the state with the greater timestamp",
        "when timestamps tie, union and sort their value sets",
        "read returns the values at the maximum timestamp",
        "done: report the converged value set",
    ],
};

export default module;
