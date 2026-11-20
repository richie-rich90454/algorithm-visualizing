/**
 * round-robin-scheduling.ts - Round Robin CPU Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Round robin is a preemptive scheduling policy. Ready processes share a
 * single queue; each dispatch runs the head process for at most one time
 * quantum. A process that still needs time goes to the back of the queue, and
 * one that has finished leaves. The policy is fair because no process waits
 * for more than a bounded number of other dispatches.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) for d dispatches, each taking constant queue work
 *   Space: O(p) for p processes plus the dispatch log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per process shows its remaining burst time.
 *   - The process currently running is highlighted; finished ones turn green.
 *   - Metadata records the full Gantt timeline and the derived times.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ProcessInput {
    processes?: Array<{ id: string; burst: number }>;
    quantum?: number;
}

interface Process {
    id: string;
    burst: number;
}

/** Serialize the Gantt log as strings for frame metadata. */
function ganttStrings(log: Array<{ id: string; start: number; end: number }>): string[] {
    return log.map((segment) => `${segment.id}:${segment.start}-${segment.end}`);
}

/** Order a per-process value map into an array aligned with the process list. */
function orderedValues(processes: Process[], values: Record<string, number>): number[] {
    return processes.map((process) => values[process.id] ?? 0);
}

/** Build cells for each process, marking the running and finished ones. */
function makeCells(
    processes: Process[],
    remaining: Record<string, number>,
    runningId: string | null,
): VisualEntity[] {
    return processes.map((process, index) => {
        const left = remaining[process.id] ?? 0;
        let state: EntityState = "idle";
        if (left === 0) {
            state = "sorted";
        } else if (process.id === runningId) {
            state = "comparing";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${process.id}: ${left}`,
            value: left,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, id: process.id, remaining: left, burst: process.burst },
        };
    });
}

/** The round robin generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ProcessInput | null) ?? {};
    const processes: Process[] = Array.isArray(task.processes)
        ? task.processes.map((p) => ({ id: String(p.id), burst: Math.max(0, Math.floor(p.burst)) }))
        : [
              { id: "P1", burst: 5 },
              { id: "P2", burst: 3 },
              { id: "P3", burst: 7 },
          ];
    const quantum = Math.max(1, Math.floor(task.quantum ?? 2));
    const remaining: Record<string, number> = {};
    for (const process of processes) {
        remaining[process.id] = process.burst;
    }
    const queue = processes.map((p) => p.id);
    const gantt: Array<{ id: string; start: number; end: number }> = [];
    const completion: Record<string, number> = {};
    let time = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(processes, remaining, null),
        edges: [],
        description: `Round robin with quantum ${quantum} over ${processes.length} process(es).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: processes.length, time: 0, gantt: [] as string[], completion: [] as number[] },
    };
    let step = 1;

    let guard = 0;
    const limit = processes.reduce((sum, p) => sum + p.burst, 0) + processes.length + 1;
    while (queue.length > 0 && guard < limit) {
        guard += 1;
        const id = queue.shift()!;
        const left = remaining[id] ?? 0;
        const slice = Math.min(quantum, left);
        const start = time;
        time += slice;
        remaining[id] = left - slice;
        gantt.push({ id, start, end: time });
        if ((remaining[id] ?? 0) > 0) {
            queue.push(id);
        } else {
            completion[id] = time;
        }
        yield {
            stepNumber: step,
            entities: makeCells(processes, remaining, id),
            edges: [],
            description: `Dispatch ${id} from ${start} to ${time} (${slice} unit(s)); ${remaining[id]} remaining.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 1, cols: processes.length, time, gantt: ganttStrings(gantt), completion: orderedValues(processes, completion) },
        };
        step += 1;
    }

    const turnaround: Record<string, number> = {};
    const waiting: Record<string, number> = {};
    for (const process of processes) {
        const finished = completion[process.id] ?? 0;
        turnaround[process.id] = finished;
        waiting[process.id] = Math.max(0, finished - process.burst);
    }
    yield {
        stepNumber: step,
        entities: makeCells(processes, remaining, null),
        edges: [],
        description: `All processes finished at time ${time}; ${gantt.length} dispatch(es).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: processes.length,
            time,
            gantt: ganttStrings(gantt),
            completion: orderedValues(processes, completion),
            turnaround: orderedValues(processes, turnaround),
            waiting: orderedValues(processes, waiting),
            done: true,
        },
    };
}

/** The round robin module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a line of jobs at a printer. Each job may use the machine for at most one quantum before going to the back of the line, so a long job cannot starve the short ones behind it. When a job finishes it simply leaves the line. The quantum controls the trade-off between responsiveness and the overhead of switching jobs.",
        invariants: [
            "The ready queue contains exactly the processes with positive remaining time.",
            "Each dispatch consumes the minimum of the quantum and the remaining burst.",
            "Total CPU time equals the sum of all burst times regardless of the quantum.",
        ],
        correctness:
            "The simulation moves the head of the queue to the back whenever it still has work, which is precisely the round robin rule, so the Gantt log records the exact schedule. A process completes when its remaining burst reaches zero, at which point its completion time is the current clock. Turnaround equals completion minus arrival, which is zero here, and waiting equals turnaround minus burst because the process was either running or waiting the whole time.",
        complexityRationale:
            "A process with burst b needs at most ceil of b over q dispatches, so the number of dispatches d is bounded by the sum of bursts over the quantum. Each dispatch is a constant-time queue operation, giving O(d) time and O(p) space for the process table and queue.",
        uses: [
            "Time slicing in operating system process schedulers",
            "Fair sharing of a single network link among flows",
            "Job scheduling in batch and time-sharing systems",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter on CPU Scheduling",
            "Tanenbaum, Modern Operating Systems, Chapter 2",
        ],
        workedExample:
            "With processes P1 burst 5, P2 burst 3, and P3 burst 7 at quantum 2, the timeline is P1, P2, P3, P1, P2, P3, P1, P3, P3. P2 finishes at time 9, P1 at 13, and P3 at 15, so the total CPU time equals the sum of bursts, 15.",
    },
    id: "round-robin-scheduling",
    name: "Round Robin Scheduling",
    category: "production-systems",
    complexity: { time: "O(d)", space: "O(p)" },
    defaultInput: {
        processes: [
            { id: "P1", burst: 5 },
            { id: "P2", burst: 3 },
            { id: "P3", burst: 7 },
        ],
        quantum: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the processes and the time quantum",
        "place all processes in the ready queue in arrival order",
        "while the ready queue is not empty",
        "remove the head process and run it for the lesser of quantum and remaining time",
        "advance the clock and record the Gantt segment",
        "if the process still needs time, append it to the back of the queue",
        "otherwise record its completion time",
        "done: report the timeline, turnaround, and waiting times",
    ],
};

export default module;
