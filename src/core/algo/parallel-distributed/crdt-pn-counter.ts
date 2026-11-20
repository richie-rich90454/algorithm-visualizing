/**
 * crdt-pn-counter.ts - PN-Counter Conflict-Free Replicated Counter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A PN-counter is a state-based CRDT that supports both increments and
 * decrements without coordination. It keeps two grow-only registers per
 * replica: P accumulates increments and N accumulates decrements. Merging two
 * replicas takes the componentwise maximum of P and N, and the counter's value
 * is the sum of all P entries minus the sum of all N entries. Because entries
 * only grow and merge is a max, concurrent updates never conflict and all
 * replicas that have seen the same updates agree exactly.
 *
 * This is a deterministic teaching simulation over an in-memory replica array.
 * It performs the exact local updates and max-merge of a state-based PN-counter,
 * but there is no real replication, no causal delivery, and no compaction of
 * tombstones. Only the convergence mechanics are faithful.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * n^2) to gossip n replicas per merge round
 *   Space: O(n^2) for every replica's P and N component vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cell (replica, component) shows that replica's P and N for the component.
 *   - The locally updated component is yellow; converged cells are green.
 *   - meta carries both vectors per replica, the value, and the convergence flag.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type CounterOp = { replica: number; type: "inc" | "dec"; amount: number };

/** Build the replica-by-component grid of P and N registers. */
function makeCells(
    p: number[][],
    negatives: number[][],
    activeReplica: number,
    activeComponent: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const n = p.length;
    for (let replica = 0; replica < n; replica += 1) {
        for (let component = 0; component < n; component += 1) {
            const pos = p[replica]?.[component] ?? 0;
            const neg = negatives[replica]?.[component] ?? 0;
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (replica === activeReplica && component === activeComponent) {
                state = "active";
            }
            entities.push({
                id: `cell-${replica}-${component}`,
                type: "cell",
                label: `r${replica} c${component}: +${pos}/-${neg}`,
                value: pos - neg,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: replica, col: component, replica, component, pos, neg },
            });
        }
    }
    return entities;
}

/** The PN-counter generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { replicas?: number; ops?: CounterOp[]; mergeRounds?: number } | null) ?? {};
    const n = Math.min(8, Math.max(1, Math.floor(Number(task.replicas ?? 3)) || 3));
    const ops: CounterOp[] = Array.isArray(task.ops)
        ? task.ops.filter((op) => op && typeof op.replica === "number").map((op) => ({
              replica: ((Math.floor(op.replica) % n) + n) % n,
              type: op.type === "dec" ? ("dec" as const) : ("inc" as const),
              amount: Math.max(0, Math.floor(Number(op.amount ?? 1)) || 1),
          }))
        : [
              { replica: 0, type: "inc", amount: 5 },
              { replica: 1, type: "dec", amount: 2 },
              { replica: 2, type: "inc", amount: 3 },
              { replica: 0, type: "dec", amount: 1 },
          ];
    const mergeRounds = Math.min(20, Math.max(1, Math.floor(Number(task.mergeRounds ?? 2)) || 2));

    const p: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    const negatives: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    let converged = false;

    const valueAt = (replica: number) => {
        const pos = p[replica]?.reduce((sum, v) => sum + v, 0) ?? 0;
        const neg = negatives[replica]?.reduce((sum, v) => sum + v, 0) ?? 0;
        return pos - neg;
    };
    const meta = (activeReplica: number, activeComponent: number, done: boolean) => ({
        rows: n,
        cols: n,
        n,
        ops: ops.length,
        mergeRounds,
        pFlat: p.flat(),
        negativesFlat: negatives.flat(),
        values: Array.from({ length: n }, (_, replica) => valueAt(replica)),
        value: valueAt(0),
        converged: done,
        activeReplica,
        activeComponent,
        note: "deterministic state-based PN-counter simulation: in-memory max-merge, no real replication",
    });

    yield {
        stepNumber: 0,
        entities: makeCells(p, negatives, -1, -1, false),
        edges: [],
        description: `${n} replicas each start with empty P and N vectors.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(-1, -1, false),
    };
    let step = 1;

    for (let i = 0; i < ops.length; i += 1) {
        const op = ops[i]!;
        const register = op.type === "inc" ? p : negatives;
        const current = register[op.replica]?.[op.replica] ?? 0;
        if (register[op.replica]) {
            register[op.replica]![op.replica] = current + op.amount;
        }
        yield {
            stepNumber: step,
            entities: makeCells(p, negatives, op.replica, op.replica, false),
            edges: [],
            description: `Replica ${op.replica} locally ${op.type === "inc" ? "increments" : "decrements"} by ${op.amount}; its own ${op.type === "inc" ? "P" : "N"} entry grows from ${current} to ${current + op.amount}.`,
            codeLineNumber: op.type === "inc" ? 2 : 3,
            layout: "grid",
            meta: meta(op.replica, op.replica, false),
        };
        step += 1;
    }

    for (let round = 0; round < mergeRounds; round += 1) {
        const pNext = p.map((row) => [...row]);
        const nNext = negatives.map((row) => [...row]);
        for (let replica = 0; replica < n; replica += 1) {
            for (let component = 0; component < n; component += 1) {
                let maxPos = 0;
                let maxNeg = 0;
                for (let source = 0; source < n; source += 1) {
                    maxPos = Math.max(maxPos, p[source]?.[component] ?? 0);
                    maxNeg = Math.max(maxNeg, negatives[source]?.[component] ?? 0);
                }
                pNext[replica]![component] = maxPos;
                nNext[replica]![component] = maxNeg;
            }
        }
        for (let replica = 0; replica < n; replica += 1) {
            p[replica] = pNext[replica]!;
            negatives[replica] = nNext[replica]!;
        }
        converged = true;
        yield {
            stepNumber: step,
            entities: makeCells(p, negatives, -1, -1, false),
            edges: [],
            description: `Merge round ${round + 1}: every replica takes the componentwise maximum of P and N, spreading updates to all replicas.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: meta(-1, -1, false),
        };
        step += 1;
    }

    // Confirm convergence: after enough full-mesh merges all replicas are identical.
    const reference = p[0] ?? [];
    converged = p.every((row) => row.every((value, component) => value === (reference[component] ?? 0)))
        && negatives.every((row) => row.every((value, component) => value === (negatives[0]?.[component] ?? 0)));
    yield {
        stepNumber: step,
        entities: makeCells(p, negatives, -1, -1, converged),
        edges: [],
        description: converged
            ? `All replicas agree: value = sum(P) minus sum(N) = ${valueAt(0)}.`
            : `Replicas have not fully converged after ${mergeRounds} merge round(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...meta(-1, -1, converged), converged },
    };
}

/** The PN-counter module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A PN-counter is two counters glued together: one only goes up for increments, the other only goes up for decrements, and the answer is their difference. When replicas meet, each takes the larger of every component it sees, so a concurrent update can never be lost. Because the registers only grow, reordering or duplicating messages is harmless, which is what makes the counter conflict-free.",
        invariants: [
            "Every P and N entry is non-negative and never decreases.",
            "Merging two replicas is the componentwise maximum of their P and N vectors.",
            "A replica's value is the sum of its P vector minus the sum of its N vector.",
        ],
        correctness:
            "Each increment is recorded by raising one replica's P component, and each decrement raises one N component, so after all updates the componentwise maxima across replicas equal the per-component totals of increments and decrements. Summing P gives total increments and summing N gives total decrements, so their difference is the correct counter value. Max is associative, commutative and idempotent, so any merge order converges replicas that have seen the same updates to the same state.",
        complexityRationale:
            "Each merge round compares every component of every replica against all other replicas, so full-mesh gossip costs O(rounds * n^2) time. Each of the n replicas stores two length-n vectors, which is O(n^2) space in total.",
        uses: [
            "Distributed like counts and metrics that need increments and decrements",
            "Conflict-free counters in Riak and other Dynamo-style stores",
            "Collaborative editing counters that must converge without coordination",
        ],
        references: [
            "Shapiro, Preguica, Baquero and Zawirski, Conflict-Free Replicated Data Types, 2011",
            "Baquero, Preguica and Shapiro, A Conflict-Free Replicated JSON Datatype, 2017",
        ],
        workedExample:
            "Three replicas start empty. Replica 0 increments by 5 and decrements by 1, replica 1 decrements by 2, and replica 2 increments by 3. After a full merge every replica holds P components 5 and 3 with N components 1 and 2, so the value is 8 minus 3, which is 5, on all replicas.",
    },
    id: "crdt-pn-counter",
    name: "PN-Counter CRDT",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * n^2)", space: "O(n^2)" },
    defaultInput: {
        replicas: 3,
        ops: [
            { replica: 0, type: "inc", amount: 5 },
            { replica: 1, type: "dec", amount: 2 },
            { replica: 2, type: "inc", amount: 3 },
            { replica: 0, type: "dec", amount: 1 },
        ],
        mergeRounds: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "each replica keeps a P vector and an N vector initialized to zero",
        "on increment at replica i add the amount to that replica's P entry i",
        "on decrement at replica i add the amount to that replica's N entry i",
        "when replicas gossip set each component to the maximum seen",
        "repeat the max merge until all replicas have the same vectors",
        "compute the value as the sum of P minus the sum of N",
        "done: report the converged counter value shared by every replica",
    ],
};

export default module;
