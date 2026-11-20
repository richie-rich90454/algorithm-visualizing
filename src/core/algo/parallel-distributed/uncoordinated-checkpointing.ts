/**
 * uncoordinated-checkpointing.ts - Domino Rollback in Uncoordinated Checkpointing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In uncoordinated checkpointing each process saves its state independently,
 * without a global snapshot. A message sent after one checkpoint and received
 * before another makes the receiver's checkpoint depend on the sender's. If a
 * process fails, its lost checkpoint forces every dependent checkpoint to roll
 * back as well, and the rollback can cascade through the system. This module
 * computes the exact set of checkpoints that must be discarded and the
 * recovery line that survives.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P * K + M) for P processes, K checkpoints each, M messages
 *   Space: O(P * K + M)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells are checkpoints: process on the vertical axis, index on the
 *     horizontal axis.
 *   - Red cells are rolled back, green cells form the recovery line, yellow
 *     cells are currently being analyzed.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Message = { from: number; to: number; send: number; recv: number };
type CheckpointInput = { processes?: number; checkpoints?: number; messages?: Message[]; failed?: number };

type Cell = { process: number; index: number };

function cellId(c: Cell): string {
    return `ckpt-${c.process}-${c.index}`;
}

function makeCells(processes: number, checkpoints: number, states: Map<string, EntityState>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let p = 0; p < processes; p += 1) {
        for (let k = 0; k < checkpoints; k += 1) {
            const id = cellId({ process: p, index: k });
            entities.push({
                id,
                type: "cell" as const,
                label: `P${p}:C${k}`,
                value: { process: p, index: k },
                state: states.get(id) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: p, col: k, process: p, checkpoint: k },
            });
        }
    }
    return entities;
}

/** Build dependency edges: a receiver checkpoint depends on a sender checkpoint. */
function buildDependencies(messages: Message[], processes: number, checkpoints: number): Array<[string, string]> {
    const deps: Array<[string, string]> = [];
    for (const m of messages) {
        if (m.from < 0 || m.from >= processes || m.to < 0 || m.to >= processes) {
            continue;
        }
        if (m.send < 0 || m.send >= checkpoints || m.recv < 0 || m.recv >= checkpoints) {
            continue;
        }
        deps.push([cellId({ process: m.to, index: m.recv }), cellId({ process: m.from, index: m.send })]);
    }
    return deps;
}

function makeEdges(deps: Array<[string, string]>, states: Map<string, EntityState>): VisualEdge[] {
    return deps.map(([dependent, dependency], index) => ({
        id: `dep-${index}`,
        sourceId: dependent,
        targetId: dependency,
        label: "depends on",
        state: states.get(`dep-${index}`) ?? "idle",
        directed: true,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CheckpointInput | null) ?? {};
    const processes = typeof task.processes === "number" ? Math.max(1, Math.min(6, task.processes)) : 3;
    const checkpoints = typeof task.checkpoints === "number" ? Math.max(1, Math.min(6, task.checkpoints)) : 4;
    const messages: Message[] = Array.isArray(task.messages) ? task.messages : [
        { from: 0, to: 1, send: 2, recv: 2 },
        { from: 1, to: 2, send: 3, recv: 2 },
        { from: 2, to: 0, send: 1, recv: 3 },
    ];
    const failed = typeof task.failed === "number" ? Math.max(0, Math.min(processes - 1, task.failed)) : 1;

    const deps = buildDependencies(messages, processes, checkpoints);
    const rollback = new Set<string>();
    const start = cellId({ process: failed, index: checkpoints - 1 });
    rollback.add(start);
    const states = new Map<string, EntityState>();
    const edgeStates = new Map<string, EntityState>();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(processes, checkpoints, states),
        edges: makeEdges(deps, edgeStates),
        description: `${processes} processes with ${checkpoints} local checkpoints each and ${deps.length} message dependencies; process ${failed} fails.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { processes, checkpoints, failed, rollbackCount: 1, recoveryLine: [], phase: "start" },
    };
    step += 1;

    const queue: string[] = [start];
    while (queue.length > 0) {
        const current = queue.shift() as string;
        states.set(current, "active");
        const outgoing: number[] = [];
        deps.forEach(([dependent, dependency], index) => {
            if (dependency === current && !rollback.has(dependent)) {
                edgeStates.set(`dep-${index}`, "active");
                outgoing.push(index);
            }
        });

        yield {
            stepNumber: step,
            entities: makeCells(processes, checkpoints, states),
            edges: makeEdges(deps, edgeStates),
            description: `Checkpoint ${current} is lost; rolling back every checkpoint that depends on it (${outgoing.length} found).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { processes, checkpoints, failed, rollbackCount: rollback.size, recoveryLine: [], phase: "propagate", current },
        };
        step += 1;

        for (const index of outgoing) {
            const dependent = deps[index]?.[0] as string;
            rollback.add(dependent);
            queue.push(dependent);
            edgeStates.set(`dep-${index}`, "error");
        }
        states.set(current, "error");
    }

    const recovery: number[] = [];
    for (let p = 0; p < processes; p += 1) {
        let chosen = -1;
        for (let k = checkpoints - 1; k >= 0; k -= 1) {
            if (!rollback.has(cellId({ process: p, index: k }))) {
                chosen = k;
                break;
            }
        }
        recovery.push(chosen);
        if (chosen >= 0) {
            states.set(cellId({ process: p, index: chosen }), "sorted");
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(processes, checkpoints, states),
        edges: makeEdges(deps, edgeStates),
        description: `Domino rollback settled: ${rollback.size} checkpoint(s) discarded; recovery line chosen.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { processes, checkpoints, failed, rollbackCount: rollback.size, recoveryLine: recovery, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Messages create links between the sender's past checkpoint and the receiver's current one. When a process loses its most recent checkpoint, every checkpoint that recorded a message from it becomes invalid, and those checkpoints may in turn invalidate others. Following these links backward finds the whole domino effect.",
        invariants: [
            "A rolled-back checkpoint forces all checkpoints that directly depend on it to roll back.",
            "The recovery line of a process is its most recent surviving checkpoint.",
            "A checkpoint in the recovery line has no dependency on a discarded checkpoint.",
        ],
        correctness:
            "The propagation is a reverse traversal of the dependency graph starting from the lost checkpoint. By induction on the traversal, every checkpoint reached has a chain of dependencies ending at the failure, so none of them can be kept. Any checkpoint not reached has no path to the failure, so keeping it is consistent. The surviving earliest checkpoint per process is therefore a valid recovery line.",
        complexityRationale:
            "Building the dependency map scans all M messages. Each checkpoint enters the rollback queue at most once and each dependency edge is examined once, giving O(P * K + M) time and the same order of space for P processes with K checkpoints.",
        uses: [
            "Failure recovery in long-running distributed computations",
            "Explaining why coordinated checkpointing avoids the domino effect",
            "Analyzing rollback latency in message-passing systems",
        ],
        references: [
            "Chandy and Lamport, Distributed Snapshots: Determining Global States, 1985",
            "Elnozahy, Alvisi, Wang, and Johnson, A Survey of Rollback-Recovery Protocols, 2002",
        ],
        workedExample:
            "Three processes each with four checkpoints and messages P0:C2 -> P1:C2, P1:C3 -> P2:C2, and P2:C1 -> P0:C3. If process 1 loses C3, then P2:C2 rolls back. The recovery line becomes C3 for process 0, C2 for process 1, and C1 for process 2.",
    },
    id: "uncoordinated-checkpointing",
    name: "Uncoordinated Checkpointing (Domino Rollback)",
    category: "parallel-distributed",
    complexity: { time: "O(P*K + M)", space: "O(P*K + M)" },
    defaultInput: {
        processes: 3,
        checkpoints: 4,
        failed: 1,
        messages: [
            { from: 0, to: 1, send: 2, recv: 2 },
            { from: 1, to: 2, send: 3, recv: 2 },
            { from: 2, to: 0, send: 1, recv: 3 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build dependencies from each sent and received message",
        "mark the failed process's latest checkpoint as lost",
        "push the lost checkpoint onto a work queue",
        "while the queue is not empty pop a lost checkpoint",
        "find checkpoints that depend on the popped checkpoint",
        "mark each dependent as lost and enqueue it",
        "choose the most recent surviving checkpoint per process",
        "done: report the recovery line",
    ],
};

export default module;
