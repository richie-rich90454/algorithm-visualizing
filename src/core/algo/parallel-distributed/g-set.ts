/**
 * g-set.ts - Grow-Only Set CRDT
 *
 * A grow-only set is the simplest conflict-free replicated data type. Each
 * replica can add elements but never remove them, and merging two replicas
 * takes the union of their elements. Union is commutative, associative, and
 * idempotent, so replicas that exchange updates in any order, including
 * duplicates, converge to exactly the same set without coordination.
 *
 * This is a deterministic simulation with a fixed add schedule and a fixed
 * universe of elements. It models ideal message delivery and ignores tombstones,
 * causal contexts, and the removal semantics needed by a two-phase set.
 *
 * Time:  O(replicas * adds + merges * elements) for the simulated schedule
 * Space: O(replicas * elements) for the per-replica sets
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface GSetInput {
    replicas?: number;
    adds?: Array<{ replica: number; element: string }>;
}

function union(a: string[], b: string[]): string[] {
    return Array.from(new Set([...a, ...b])).sort();
}

function makeCells(replicas: string[][], elements: string[], activeReplica: number, final: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < replicas.length; row += 1) {
        for (let col = 0; col < elements.length; col += 1) {
            const present = replicas[row]?.includes(elements[col] ?? "") ?? false;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: `${elements[col]}: ${present ? "1" : "0"}`,
                value: present ? 1 : 0,
                state: final ? "sorted" : row === activeReplica ? "comparing" : present ? "visited" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, replica: row, element: elements[col] ?? "", present },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GSetInput | null) ?? {};
    const replicaCount = Math.min(6, Math.max(2, Math.floor(Number(task.replicas ?? 3)) || 3));
    const schedule = Array.isArray(task.adds) && task.adds.length > 0
        ? task.adds.slice(0, 30).map((add) => ({
              replica: Math.min(replicaCount - 1, Math.max(0, Math.floor(Number(add?.replica) || 0))),
              element: String(add?.element ?? "x"),
          }))
        : [
              { replica: 0, element: "a" },
              { replica: 1, element: "b" },
              { replica: 2, element: "a" },
              { replica: 0, element: "c" },
              { replica: 2, element: "b" },
          ];
    const elements = Array.from(new Set(schedule.map((add) => add.element))).sort();
    const replicas: string[][] = Array.from({ length: replicaCount }, () => []);

    yield {
        stepNumber: 0,
        entities: makeCells(replicas, elements, -1, false),
        edges: [],
        description: `${replicaCount} replicas start with empty grow-only sets over elements ${elements.join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { replicas: replicaCount, elements, sets: replicas.map((s) => [...s]), add: null, merged: [], converged: false, done: false },
    };

    let step = 1;
    for (let i = 0; i < schedule.length; i += 1) {
        const add = schedule[i]!;
        const set = replicas[add.replica];
        if (set && !set.includes(add.element)) {
            set.push(add.element);
            set.sort();
        }
        yield {
            stepNumber: step,
            entities: makeCells(replicas, elements, add.replica, false),
            edges: [],
            description: `Replica ${add.replica} adds "${add.element}"; its set only grows, never shrinks.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                replicas: replicaCount,
                elements,
                sets: replicas.map((s) => [...s]),
                add: { replica: add.replica, element: add.element },
                merged: [],
                converged: false,
                done: false,
            },
        };
        step += 1;
    }

    let merged: string[] = [];
    for (let replica = 0; replica < replicaCount; replica += 1) {
        merged = union(merged, replicas[replica] ?? []);
        yield {
            stepNumber: step,
            entities: makeCells(replicas, elements, replica, false),
            edges: [],
            description: `Merge replica ${replica} into the aggregate by union; the aggregate is now ${merged.join(", ") || "empty"}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                replicas: replicaCount,
                elements,
                sets: replicas.map((s) => [...s]),
                add: null,
                merged: [...merged],
                converged: replica === replicaCount - 1,
                done: replica === replicaCount - 1,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(replicas.map(() => merged), elements, -1, true),
        edges: [],
        description: `All replicas converge to the same set ${merged.join(", ")} regardless of merge order or duplicate delivery.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            replicas: replicaCount,
            elements,
            sets: replicas.map((s) => [...s]),
            add: null,
            merged: [...merged],
            converged: true,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If a data type only ever gains elements, conflicts are easy: just keep everything anyone has ever added. A grow-only set stores one local set per replica, adds insert into that set, and a merge takes the union. Because union cannot lose information, sending the same update twice or merging in a different order changes nothing. Replicas therefore converge without locks or a coordinator.",
        invariants: [
            "A replica's set is a subset of its set at every later step.",
            "An element once present in any replica remains present after every merge.",
            "Union of two sets is independent of the order in which the operands are given.",
        ],
        correctness:
            "Addition is monotone insertion and merge is set union. Union is commutative, associative, and idempotent, which are exactly the conditions for a state-based CRDT to converge. Any delivery schedule produces the same union of all locally added elements, so replicas that have seen the same updates hold identical sets. Since removal is not defined, there is no tombstone or causal-history hazard to resolve.",
        complexityRationale:
            "Each add touches one replica set and each merge scans the elements of two sets, so the schedule costs time proportional to the adds plus the merge work. Storing one set per replica over the element universe uses O(replicas * elements) space.",
        uses: [
            "Distributed tags or labels that are only ever added",
            "Shared allowlists and feature flags updated by several services",
            "A building block for more expressive CRDTs such as two-phase sets",
        ],
        references: [
            "Shapiro, Preguica, Baquero and Zawirski, Conflict-Free Replicated Data Types, 2011",
            "Verkest, Making CRDTs Easy, 2019",
        ],
        workedExample:
            "Replica A adds apple, replica B adds banana and apple. Merging A into B yields apple and banana; merging B into A yields the same pair, and merging A a second time changes nothing. Both replicas end with the identical set.",
    },
    id: "g-set",
    name: "Grow-Only Set",
    category: "parallel-distributed",
    complexity: { time: "O(adds + merges * elements)", space: "O(replicas * elements)" },
    defaultInput: {
        replicas: 3,
        adds: [
            { replica: 0, element: "a" },
            { replica: 1, element: "b" },
            { replica: 2, element: "a" },
            { replica: 0, element: "c" },
            { replica: 2, element: "b" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with one empty set at each replica",
        "when a replica adds an element, insert it into its own set",
        "never remove an element from any replica",
        "to merge replicas, take the union of their sets",
        "union is commutative, associative, and idempotent",
        "deliver merges in any order, including duplicates",
        "all replicas that saw the same adds now hold the same set",
        "done: report the converged set",
    ],
};

export default module;
