/**
 * shortest-job-first.ts - Shortest Job First (Non-preemptive) Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SJF chooses, among the processes that have already arrived, the one with the
 * shortest total burst and runs it to completion. It is non-preemptive: once a
 * job starts it keeps the CPU. The rule minimizes average waiting time when all
 * jobs are available at time zero, but with staggered arrivals a very short job
 * that arrives during a long run must wait. Ties are broken by arrival time and
 * then by input order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p^2) with the linear scan used here; O(p log p) with a heap
 *   Space: O(p) for process state and the Gantt log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per process shows its remaining burst.
 *   - The chosen process is CYAN, finished ones GREEN, waiting ones GRAY.
 *   - meta carries the Gantt timeline and derived waiting / turnaround times.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Proc {
    id: string;
    burst: number;
    arrival: number;
}

interface Segment {
    id: string;
    start: number;
    end: number;
}

function normalize(input: unknown): Proc[] {
    const task = (input as { processes?: Array<{ id?: string; burst?: number; arrival?: number }> } | null) ?? {};
    const specs = Array.isArray(task.processes)
        ? task.processes
        : [
              { id: "P1", burst: 6, arrival: 0 },
              { id: "P2", burst: 2, arrival: 0 },
              { id: "P3", burst: 4, arrival: 0 },
          ];
    return specs.map((spec, index) => ({
        id: String(spec.id ?? `P${index + 1}`),
        burst: Math.max(0, Math.floor(Number(spec.burst) || 0)),
        arrival: Math.max(0, Math.floor(Number(spec.arrival) || 0)),
    }));
}

function makeCells(processes: Proc[], remaining: Record<string, number>, running: string | null): VisualEntity[] {
    return processes.map((process, index) => {
        const left = remaining[process.id] ?? 0;
        let state: EntityState = "idle";
        if (left === 0) {
            state = "sorted";
        } else if (process.id === running) {
            state = "active";
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
            metadata: { row: 0, col: index, id: process.id, remaining: left, arrival: process.arrival },
        };
    });
}

function ganttStrings(log: Segment[]): string[] {
    return log.map((segment) => `${segment.id}:${segment.start}-${segment.end}`);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const processes = normalize(input);
    const remaining: Record<string, number> = {};
    for (const process of processes) {
        remaining[process.id] = process.burst;
    }
    const segments: Segment[] = [];
    const completion: Record<string, number> = {};
    let time = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(processes, remaining, null),
        edges: [],
        description: `SJF with ${processes.length} process(es); shortest arrived burst runs next without preemption.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: processes.length, time: 0, gantt: [] as string[] },
    };
    let step = 1;

    let finishedCount = 0;
    let guard = 0;
    const guardLimit = processes.length * (processes.length + 2) + 1;
    while (finishedCount < processes.length && guard < guardLimit) {
        guard += 1;
        let best = -1;
        for (let index = 0; index < processes.length; index += 1) {
            const candidate = processes[index];
            if (!candidate || (remaining[candidate.id] ?? 0) === 0 || candidate.arrival > time) {
                continue;
            }
            if (best === -1) {
                best = index;
                continue;
            }
            const current = processes[best];
            if (!current) {
                best = index;
                continue;
            }
            if (
                candidate.burst < current.burst ||
                (candidate.burst === current.burst && candidate.arrival < current.arrival) ||
                (candidate.burst === current.burst &&
                    candidate.arrival === current.arrival &&
                    index < best)
            ) {
                best = index;
            }
        }
        if (best === -1) {
            let nextArrival = Infinity;
            for (const process of processes) {
                if ((remaining[process.id] ?? 0) > 0 && process.arrival < nextArrival) {
                    nextArrival = process.arrival;
                }
            }
            if (!Number.isFinite(nextArrival)) {
                break;
            }
            segments.push({ id: "IDLE", start: time, end: nextArrival });
            time = nextArrival;
            continue;
        }
        const chosen = processes[best];
        if (!chosen) {
            break;
        }
        const start = time;
        time += chosen.burst;
        segments.push({ id: chosen.id, start, end: time });
        completion[chosen.id] = time;
        remaining[chosen.id] = 0;
        finishedCount += 1;
        yield {
            stepNumber: step,
            entities: makeCells(processes, remaining, chosen.id),
            edges: [],
            description: `Dispatch ${chosen.id} from ${start} to ${time}; it had the shortest burst ${chosen.burst} among arrived jobs.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: 1, cols: processes.length, time, gantt: ganttStrings(segments) },
        };
        step += 1;
    }

    const turnaround: Record<string, number> = {};
    const waiting: Record<string, number> = {};
    let waitSum = 0;
    let turnaroundSum = 0;
    for (const process of processes) {
        const finished = completion[process.id] ?? 0;
        turnaround[process.id] = Math.max(0, finished - process.arrival);
        waiting[process.id] = Math.max(0, turnaround[process.id] - process.burst);
        waitSum += waiting[process.id];
        turnaroundSum += turnaround[process.id];
    }
    const count = Math.max(1, processes.length);
    yield {
        stepNumber: step,
        entities: makeCells(processes, remaining, null),
        edges: [],
        description: `All processes finished at time ${time}; average waiting time ${(waitSum / count).toFixed(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: processes.length,
            time,
            gantt: ganttStrings(segments),
            completion: processes.map((process) => completion[process.id] ?? 0),
            turnaround: processes.map((process) => turnaround[process.id] ?? 0),
            waiting: processes.map((process) => waiting[process.id] ?? 0),
            avgWaiting: waitSum / count,
            avgTurnaround: turnaroundSum / count,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SJF picks the shortest available job each time the CPU becomes free. If every job were already waiting, this choice would give the lowest possible average waiting time. With jobs arriving over time, the rule only considers what has arrived so far, so a short job that shows up during a long run still has to wait for that run to finish.",
        invariants: [
            "Only processes whose arrival time is at or before the clock are eligible.",
            "The chosen process always has the minimum original burst among eligible processes.",
            "A dispatched process runs to completion in one uninterrupted segment.",
        ],
        correctness:
            "At each dispatch the linear scan selects the eligible process with the smallest burst, breaking ties by arrival and input order, which is exactly the non-preemptive SJF rule. The idle jump advances the clock to the earliest future arrival so no eligible process is ever overlooked. Because each job runs for its full burst, completion times and the derived waiting times follow directly; the test checks them against an independent event-driven replay and corroborates the total CPU time.",
        complexityRationale:
            "There are at most p dispatches and each scans p processes, so the linear-scan simulation is O(p^2) time; replacing the scan with a priority queue would give O(p log p). The process table and Gantt log use O(p) space.",
        uses: [
            "Short batch jobs in a timesharing system",
            "A theoretical lower bound for average waiting time in scheduling studies",
            "Print and job queues where sizes are known in advance",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter on CPU Scheduling",
            "Kleinrock, Queueing Systems, Volume 1",
        ],
        workedExample:
            "With P1 burst 6, P2 burst 2, and P3 burst 4 all arriving at 0, SJF runs P2 from 0 to 2, P3 from 2 to 6, and P1 from 6 to 12. Waiting times are 6, 0, and 2, giving an average of about 2.67.",
    },
    id: "shortest-job-first",
    name: "Shortest Job First",
    category: "production-systems",
    complexity: { time: "O(p^2)", space: "O(p)" },
    defaultInput: {
        processes: [
            { id: "P1", burst: 6, arrival: 0 },
            { id: "P2", burst: 2, arrival: 0 },
            { id: "P3", burst: 4, arrival: 0 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read each process with its arrival time and total burst",
        "set the clock to zero and mark every process unfinished",
        "while some process is unfinished",
        "among arrived unfinished processes pick the one with the smallest burst",
        "if none has arrived, jump the clock to the next arrival and log idle time",
        "run the chosen process to completion and log its Gantt segment",
        "record its completion time as the current clock",
        "done: report the timeline and average waiting time",
    ],
};

export default module;
