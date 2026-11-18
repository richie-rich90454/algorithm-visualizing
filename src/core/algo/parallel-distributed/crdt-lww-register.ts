/**
 * crdt-lww-register.ts - Last-Writer-Wins Register CRDT (toy simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A last-writer-wins register is a conflict-free replicated data type that
 * holds one value. Each update carries a timestamp (a Lamport counter paired
 * with the replica id). Merging two registers keeps the operand with the
 * greater timestamp, breaking ties by replica id, so every replica converges
 * to the same value regardless of the order in which updates are merged.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(updates + replicas * merges) in this simulation
 *   Space: O(replicas) for the replica registers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each replica is a grid cell showing its current value.
 *   - A replica being updated or merged is yellow; the winner is green.
 *   - The metadata reports the winning value and its timestamp.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Update {
    replica: number;
    value: number;
}

interface Register {
    value: number;
    counter: number;
    replicaId: number;
}

/** True when the left timestamp is strictly newer than the right one. */
function newer(left: Register, right: Register): boolean {
    return left.counter > right.counter || (left.counter === right.counter && left.replicaId > right.replicaId);
}

/** Build replica cells. */
function makeCells(
    registers: Register[],
    active: number,
    activeState: EntityState,
): VisualEntity[] {
    return registers.map((register, index) => ({
        id: `replica-${index}`,
        type: "cell" as const,
        label: register.counter === 0 ? "-" : String(register.value),
        value: register.value,
        state: index === active ? activeState : register.counter === 0 ? "idle" : "visited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, counter: register.counter, replicaId: register.replicaId },
    }));
}

/** The last-writer-wins register generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { replicas?: number; updates?: Update[] } | null) ?? {};
    const replicas =
        typeof task.replicas === "number" && task.replicas >= 1 ? Math.floor(task.replicas) : 3;
    const updates: Update[] =
        Array.isArray(task.updates) && task.updates.length > 0
            ? task.updates
                  .filter(
                      (item): item is Update =>
                          !!item && typeof item.replica === "number" && typeof item.value === "number",
                  )
                  .map((item) => ({
                      replica: ((Math.floor(item.replica) % replicas) + replicas) % replicas,
                      value: item.value,
                  }))
            : [
                  { replica: 0, value: 5 },
                  { replica: 1, value: 9 },
                  { replica: 2, value: 3 },
              ];

    const registers: Register[] = Array.from({ length: replicas }, (_, index) => ({
        value: -1,
        counter: 0,
        replicaId: index,
    }));
    let merges = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(registers, -1, "idle"),
        edges: [],
        description: `Starting an LWW register with ${replicas} replica(s) and ${updates.length} update(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: replicas, value: -1, timestamp: 0, replicaId: -1, converged: false, merges: 0 },
    };
    step += 1;

    for (const update of updates) {
        const register = registers[update.replica]!;
        register.counter += 1;
        register.value = update.value;
        yield {
            stepNumber: step,
            entities: makeCells(registers, update.replica, "comparing"),
            edges: [],
            description: `Replica ${update.replica} writes ${update.value} with timestamp (${register.counter}, ${update.replica}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 1, cols: replicas, value: register.value, timestamp: register.counter, replicaId: register.replicaId, converged: false, merges },
        };
        step += 1;
    }

    for (let round = 0; round < replicas - 1; round += 1) {
        for (let index = 0; index < replicas; index += 1) {
            const target = (index + 1) % replicas;
            const left = registers[index]!;
            const right = registers[target]!;
            if (newer(right, left)) {
                registers[index] = { ...right };
            } else if (newer(left, right)) {
                registers[target] = { ...left };
            }
            merges += 1;
            yield {
                stepNumber: step,
                entities: makeCells(registers, target, "active"),
                edges: [],
                description: `Merge replicas ${index} and ${target}; the newer timestamp wins.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { rows: 1, cols: replicas, value: left.value, timestamp: left.counter, replicaId: left.replicaId, converged: false, merges },
            };
            step += 1;
        }
    }

    const winner = registers.reduce((best, register) => (newer(register, best) ? register : best), registers[0]!);
    yield {
        stepNumber: step,
        entities: makeCells(registers, -1, "sorted"),
        edges: [],
        description: `All replicas converged to value ${winner.value} with timestamp (${winner.counter}, ${winner.replicaId}).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 1, cols: replicas, value: winner.value, timestamp: winner.counter, replicaId: winner.replicaId, converged: true, merges },
    };
}

/** The last-writer-wins register module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Every write is stamped with a counter and the writer's id. When two replicas disagree, the one with the newer stamp wins. Because 'take the maximum stamp' gives the same answer no matter which pairs you compare first, replicas that exchange updates eventually all hold the same value.",
        invariants: [
            "A replica's counter only increases, so timestamps are monotonic per replica.",
            "Merging two registers keeps the operand with the greater timestamp.",
            "Ties in the counter are broken by the larger replica id.",
        ],
        correctness:
            "The merge operation is the maximum over a totally ordered set of timestamps. Maximum is associative, commutative, and idempotent, so any gossip or merge order yields the same register. The value stored with the greatest timestamp is therefore the unique value at every replica once all updates have propagated.",
        complexityRationale:
            "Applying u updates is O(u). A full anti-entropy pass merges each replica with a neighbor for O(replicas) comparisons per round, and O(replicas) space holds the registers.",
        uses: [
            "Replicated key-value stores such as Riak and Dynamo",
            "Collaborative documents where the latest edit wins",
            "Conflict-free state in offline-first mobile applications",
        ],
        references: [
            "Shapiro et al., A Comprehensive Study of Convergent and Commutative Replicated Data Types, 2011",
            "Preguica et al., A Simple and Robust Conflict-Free Replicated Object, 2009",
        ],
        workedExample:
            "Replica 0 writes 5 with stamp (1,0), replica 1 writes 9 with stamp (1,1), and replica 2 writes 3 with stamp (1,2). All stamps share counter 1, so the largest replica id wins and every replica converges to 3.",
    },
    id: "crdt-lww-register",
    name: "LWW Register CRDT",
    category: "parallel-distributed",
    complexity: { time: "O(updates + replicas * merges)", space: "O(replicas)" },
    defaultInput: {
        replicas: 3,
        updates: [
            { replica: 0, value: 5 },
            { replica: 1, value: 9 },
            { replica: 2, value: 3 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "each replica starts with an empty register",
        "for each update at a replica",
        "increment its counter and stamp the new value",
        "for each pair of replicas in a merge pass",
        "keep the value with the newer timestamp",
        "break counter ties by the larger replica id",
        "repeat passes until all replicas agree",
        "done: report the converged value",
    ],
};

export default module;
