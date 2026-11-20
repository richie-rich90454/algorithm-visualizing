/**
 * delta-state-crdt.ts - Delta-State CRDT (OR-Set)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A delta-state CRDT avoids shipping the whole replica state on every gossip.
 * Each local update produces a small delta, called a join-irreducible element,
 * that is sent alone. Because the CRDT state is a join semilattice, merging a
 * delta is just the same join used for full states: taking the union of add
 * dots and removal tombstones. Replaying the same delta twice is harmless, and
 * the order in which deltas arrive does not affect the final state.
 *
 * This is a deterministic in-memory simulation of a delta-state OR-set. It
 * models dot generation, delta creation, anti-entropy delivery, and convergence,
 * but no real network, transport, or delta-group causal buffering.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * replicas * deltas * setSize) for the simulated gossip
 *   Space: O(replicas * (dots + tombstones))
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show whether each replica currently contains each element.
 *   - A cell updated by the current delta is yellow; converged cells are green.
 *   - meta carries the per-replica dot sets, tombstones, and convergence flag.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Operation = { replica: number; type: "add" | "remove"; element: string };
type Delta = { origin: number; added: string[]; removed: string[]; element: string };

interface DeltaCrdtInput {
    replicas?: number;
    operations?: Operation[];
    rounds?: number;
}

function makeCells(elements: string[], present: boolean[][], active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let replica = 0; replica < present.length; replica += 1) {
        for (let column = 0; column < elements.length; column += 1) {
            const value = present[replica]?.[column] ? 1 : 0;
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (replica === active) {
                state = "active";
            }
            entities.push({
                id: `cell-${replica}-${column}`,
                type: "cell" as const,
                label: `${elements[column]}:${value}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: replica, col: column, replica, element: elements[column] ?? "", present: Boolean(present[replica]?.[column]) },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DeltaCrdtInput | null) ?? {};
    const replicaCount = Math.min(6, Math.max(1, Math.floor(Number(task.replicas ?? 3)) || 3));
    const operations: Operation[] = Array.isArray(task.operations) && task.operations.length > 0
        ? task.operations.map((op) => ({
              replica: ((Math.floor(Number(op.replica) || 0) % replicaCount) + replicaCount) % replicaCount,
              type: op.type === "remove" ? "remove" as const : "add" as const,
              element: String(op.element ?? "a"),
          }))
        : [
              { replica: 0, type: "add", element: "a" },
              { replica: 1, type: "add", element: "b" },
              { replica: 0, type: "remove", element: "a" },
              { replica: 2, type: "add", element: "a" },
          ];
    const rounds = Math.min(10, Math.max(1, Math.floor(Number(task.rounds ?? 2)) || 2));
    const elements = Array.from(new Set(operations.map((op) => op.element))).slice(0, 8);

    const addSets: Set<string>[] = Array.from({ length: replicaCount }, () => new Set<string>());
    const removeSets: Set<string>[] = Array.from({ length: replicaCount }, () => new Set<string>());
    const counters: number[] = Array.from({ length: replicaCount }, () => 0);
    const deltas: Delta[] = [];
    let step = 0;

    const presentAt = (replica: number) => elements.map((element) => {
        const adds = addSets[replica];
        const removes = removeSets[replica];
        if (!adds || !removes) {
            return false;
        }
        for (const dot of adds) {
            if (dot.endsWith(`#${element}`) && !removes.has(dot)) {
                return true;
            }
        }
        return false;
    });
    const converge = () => {
        const referenceAdds = [...(addSets[0] ?? new Set<string>())].sort().join("|");
        const referenceRemoves = [...(removeSets[0] ?? new Set<string>())].sort().join("|");
        return addSets.every((set) => [...set].sort().join("|") === referenceAdds)
            && removeSets.every((set) => [...set].sort().join("|") === referenceRemoves);
    };
    const meta = (active: number, delivered: number, done: boolean) => ({
        rows: replicaCount,
        cols: elements.length,
        replicas: replicaCount,
        elements,
        present: Array.from({ length: replicaCount }, (_, replica) => presentAt(replica)),
        adds: addSets.map((set) => [...set].sort()),
        removes: removeSets.map((set) => [...set].sort()),
        deltas: deltas.length,
        delivered,
        converged: done,
        active,
        note: "deterministic delta-state OR-set simulation: in-memory union join, no real network or causal delta buffering",
    });

    yield {
        stepNumber: step,
        entities: makeCells(elements, Array.from({ length: replicaCount }, () => elements.map(() => false)), -1, false),
        edges: [],
        description: `${replicaCount} replicas start with empty add and tombstone sets.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(-1, 0, false),
    };
    step += 1;

    for (const operation of operations) {
        const replica = operation.replica;
        const added: string[] = [];
        const removed: string[] = [];
        if (operation.type === "add") {
            counters[replica] = (counters[replica] ?? 0) + 1;
            const dot = `r${replica}:${counters[replica]}#${operation.element}`;
            addSets[replica]?.add(dot);
            added.push(dot);
        } else {
            for (const dot of addSets[replica] ?? []) {
                if (dot.endsWith(`#${operation.element}`) && !removeSets[replica]?.has(dot)) {
                    removeSets[replica]?.add(dot);
                    removed.push(dot);
                }
            }
        }
        const delta: Delta = { origin: replica, added, removed, element: operation.element };
        deltas.push(delta);
        yield {
            stepNumber: step,
            entities: makeCells(elements, Array.from({ length: replicaCount }, (_, index) => presentAt(index)), replica, false),
            edges: [],
            description: `Replica ${replica} ${operation.type === "add" ? "adds" : "removes"} ${operation.element}; delta carries ${added.length} add dot(s) and ${removed.length} tombstone(s).`,
            codeLineNumber: operation.type === "add" ? 2 : 3,
            layout: "grid",
            meta: { ...meta(replica, 0, false), lastDelta: delta },
        };
        step += 1;
    }

    let delivered = 0;
    for (let round = 0; round < rounds; round += 1) {
        // Anti-entropy: every replica joins the deltas it has not seen into its state.
        for (let replica = 0; replica < replicaCount; replica += 1) {
            for (const delta of deltas) {
                if (delta.origin === replica) {
                    continue;
                }
                for (const dot of delta.added) {
                    addSets[replica]?.add(dot);
                }
                for (const dot of delta.removed) {
                    removeSets[replica]?.add(dot);
                }
                delivered += 1;
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(elements, Array.from({ length: replicaCount }, (_, index) => presentAt(index)), -1, false),
            edges: [],
            description: `Gossip round ${round + 1}: replicas joined ${deltas.length} delta(s) each; ${delivered} deliveries so far.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: meta(-1, delivered, false),
        };
        step += 1;
    }

    const converged = converge();
    yield {
        stepNumber: step,
        entities: makeCells(elements, Array.from({ length: replicaCount }, (_, index) => presentAt(index)), -1, converged),
        edges: [],
        description: converged
            ? `All replicas agree after delta gossip: ${presentAt(0).filter(Boolean).length} element(s) present.`
            : "Replicas have not fully converged after the configured gossip rounds.",
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...meta(-1, delivered, converged), converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A state-based CRDT sends its whole state whenever replicas gossip, which wastes bandwidth. A delta-state CRDT notices that each update only adds a tiny piece to the state. Send that piece instead, and let the receiver join it into its own state. Because the join is a union that cannot undo anything, duplicates and out-of-order delivery are harmless.",
        invariants: [
            "Each add creates a unique dot that is never reused.",
            "A remove only tombstones dots that were observed locally at the removing replica.",
            "Merging a delta is the same union join used to merge full states.",
        ],
        correctness:
            "The state of each replica is a pair of sets ordered by subset inclusion, which is a join semilattice whose join is union. A local update adds one dot to the add set or one tombstone to the removal set, so it is a join-irreducible delta. Since union is associative, commutative and idempotent, applying every delta in any order and any number of times yields the union of all deltas on every replica. An element is present exactly when some add dot for it lacks a matching tombstone, which is the OR-set semantics.",
        complexityRationale:
            "Creating each delta is proportional to the number of dots for that element. Simulated gossip over rounds, replicas and deltas costs O(rounds times replicas times deltas times set size) time, and each replica stores its add and tombstone sets, giving O(replicas times set size) space.",
        uses: [
            "Bandwidth-efficient synchronization in distributed databases and caches",
            "Offline-first collaborative editors that exchange only recent changes",
            "Multi-cloud replicated sets and counters with idempotent delivery",
        ],
        references: [
            "Almeida, Baquero, Goncalves and Ferreira, Delta-State CRDTs, 2016",
            "Shapiro, Preguica, Baquero and Zawirski, Conflict-Free Replicated Data Types, 2011",
        ],
        workedExample:
            "Three replicas start empty. Replica 0 adds a, replica 1 adds b, replica 0 removes a, and replica 2 adds a again with a fresh dot. After one gossip round every replica holds both add dots and one tombstone, so b and the second a are present while the first a is not.",
    },
    id: "delta-state-crdt",
    name: "Delta-State CRDT",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * replicas * deltas * setSize)", space: "O(replicas * setSize)" },
    defaultInput: {
        replicas: 3,
        operations: [
            { replica: 0, type: "add", element: "a" },
            { replica: 1, type: "add", element: "b" },
            { replica: 0, type: "remove", element: "a" },
            { replica: 2, type: "add", element: "a" },
        ],
        rounds: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize each replica with empty add and tombstone sets",
        "on add create a unique dot and emit a delta containing it",
        "on remove tombstone the observed dots of that element",
        "join each received delta by uniting add and tombstone sets",
        "gossip deltas to every other replica each round",
        "decide an element present when an untombstoned dot exists",
        "repeat until every replica has the same state",
        "done: report the converged set contents",
    ],
};

export default module;
