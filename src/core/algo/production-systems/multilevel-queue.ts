/**
 * multilevel-queue.ts - Multilevel Queue Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A multilevel queue partitions processes into fixed queues, for example
 * foreground interactive jobs and background batch jobs. A process stays in
 * the queue it was assigned to for its whole life; nothing is promoted or
 * demoted. Queues have fixed priorities and are served in strict order, while
 * processes inside a single queue run first come first served. A high-priority
 * queue that never empties can starve the lower ones. This is the fixed cousin
 * of the multilevel feedback queue, which moves jobs between levels.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p + q) for the simulation with q queues and p processes
 *   Space: O(p + q) for the queues and process state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per process; its row is its fixed queue assignment.
 *   - The dispatched process is CYAN, finished ones GREEN.
 *   - meta carries the Gantt timeline and the fixed queue of each process.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Proc {
    id: string;
    burst: number;
    arrival: number;
    queue: number;
}

interface Segment {
    id: string;
    start: number;
    end: number;
}

function normalize(input: unknown): Proc[] {
    const task = (
        input as { processes?: Array<{ id?: string; burst?: number; arrival?: number; queue?: number }>; levels?: number } | null
    ) ?? {};
    const levels = Math.max(1, Math.min(8, Math.floor(Number(task.levels) || 3)));
    const specs = Array.isArray(task.processes)
        ? task.processes
        : [
              { id: "P1", burst: 4, arrival: 0, queue: 0 },
              { id: "P2", burst: 6, arrival: 0, queue: 1 },
              { id: "P3", burst: 3, arrival: 0, queue: 2 },
          ];
    return specs.map((spec, index) => {
        const rawQueue = Math.floor(Number(spec.queue) || 0);
        return {
            id: String(spec.id ?? `P${index + 1}`),
            burst: Math.max(0, Math.floor(Number(spec.burst) || 0)),
            arrival: Math.max(0, Math.floor(Number(spec.arrival) || 0)),
            queue: Math.max(0, Math.min(levels - 1, rawQueue)),
        };
    });
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
            label: `${process.id} q${process.queue}: ${left}`,
            value: left,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: process.queue, col: index, id: process.id, remaining: left, queue: process.queue },
        };
    });
}

function ganttStrings(log: Segment[]): string[] {
    return log.map((segment) => `${segment.id}:${segment.start}-${segment.end}`);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const processes = normalize(input);
    const levels = Math.max(1, Math.min(8, Math.floor(Number((input as { levels?: number } | null)?.levels) || 3)));
    const remaining: Record<string, number> = {};
    const completion: Record<string, number> = {};
    let finishedCount = 0;
    for (const process of processes) {
        remaining[process.id] = process.burst;
        if (process.burst === 0) {
            completion[process.id] = process.arrival;
            finishedCount += 1;
        }
    }
    const queues: string[][] = Array.from({ length: levels }, () => []);
    const admitted = new Set<string>();
    const segments: Segment[] = [];
    const totalBurst = processes.reduce((sum, process) => sum + process.burst, 0);
    let time = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(processes, remaining, null),
        edges: [],
        description: `Multilevel queue with ${levels} fixed queue(s); each queue runs its own jobs first come first served.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: levels,
            cols: processes.length,
            time: 0,
            gantt: [] as string[],
            queueOf: processes.map((process) => process.queue),
        },
    };
    let step = 1;

    let guard = 0;
    const guardLimit = totalBurst + processes.length * levels + 1;
    while (finishedCount < processes.length && guard < guardLimit) {
        guard += 1;
        for (const process of processes) {
            if (!admitted.has(process.id) && process.arrival <= time && (remaining[process.id] ?? 0) > 0) {
                admitted.add(process.id);
                queues[process.queue]?.push(process.id);
            }
        }
        let level = -1;
        for (let index = 0; index < levels; index += 1) {
            if ((queues[index]?.length ?? 0) > 0) {
                level = index;
                break;
            }
        }
        if (level === -1) {
            let nextArrival = Infinity;
            for (const process of processes) {
                if (!admitted.has(process.id) && process.arrival < nextArrival) {
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
        const id = queues[level]?.shift();
        if (!id) {
            continue;
        }
        const slice = remaining[id] ?? 0;
        const start = time;
        time += slice;
        remaining[id] = 0;
        const last = segments[segments.length - 1];
        if (last && last.id === id && last.end === start) {
            last.end = time;
        } else {
            segments.push({ id, start, end: time });
        }
        completion[id] = time;
        finishedCount += 1;
        yield {
            stepNumber: step,
            entities: makeCells(processes, remaining, id),
            edges: [],
            description: `Ran ${id} from ${start} to ${time}; it belongs permanently to queue ${level}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: levels,
                cols: processes.length,
                time,
                gantt: ganttStrings(segments),
                queueOf: processes.map((process) => process.queue),
            },
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
            rows: levels,
            cols: processes.length,
            time,
            gantt: ganttStrings(segments),
            queueOf: processes.map((process) => process.queue),
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
            "A multilevel queue sorts jobs into permanent lanes, such as interactive users and background batch work. Each lane has its own waiting line, and the scheduler always drains the higher-priority lane before looking at a lower one. Nothing ever moves between lanes, so the policy is predictable but inflexible: a busy top lane can starve everything below it.",
        invariants: [
            "Every process stays in the queue it was assigned to; there is no demotion or promotion.",
            "Queues are served in strict priority order and each queue runs first come first served.",
            "Total CPU time equals the sum of all bursts regardless of queue assignment.",
        ],
        correctness:
            "The simulation admits each arriving process into its fixed queue and dispatches from the lowest-indexed nonempty queue, taking the head of that queue, which is exactly strict inter-queue priority with FCFS inside a queue. A process runs for its whole burst in one segment, so completion and the derived waiting times are correct; the test replays the queue dynamics independently, confirms the fixed assignments never change, and verifies the timeline accounting.",
        complexityRationale:
            "A process is admitted and dispatched once, and each dispatch scans at most q queues, so the simulation is O(p + q) with q fixed levels. Storing the queues and process counters uses O(p + q) space.",
        uses: [
            "Separating interactive from batch workloads in an operating system",
            "Tiered service classes in network schedulers",
            "A baseline for comparing against feedback-based schedulers",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter on CPU Scheduling",
            "Tanenbaum, Modern Operating Systems, Chapter 2",
        ],
        workedExample:
            "With queue 0 holding P1 burst 4 and queue 1 holding P2 burst 6 and P3 burst 3, all at time 0, the timeline is P1 from 0 to 4, then P2 from 4 to 10, then P3 from 10 to 13. Queue 0 must be completely empty before queue 1 starts.",
    },
    id: "multilevel-queue",
    name: "Multilevel Queue",
    category: "production-systems",
    complexity: { time: "O(p + q)", space: "O(p + q)" },
    defaultInput: {
        processes: [
            { id: "P1", burst: 4, arrival: 0, queue: 0 },
            { id: "P2", burst: 6, arrival: 0, queue: 1 },
            { id: "P3", burst: 3, arrival: 0, queue: 2 },
        ],
        levels: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read processes with their burst, arrival, and fixed queue number",
        "create one empty ready queue per priority level",
        "while some process is unfinished",
        "admit every process whose arrival time has been reached into its fixed queue",
        "find the highest-priority nonempty queue and remove its head",
        "run that process to completion and log its Gantt segment",
        "if no queue is ready, jump the clock to the next arrival and log idle time",
        "done: report the timeline, fixed queues, and average waiting time",
    ],
};

export default module;
