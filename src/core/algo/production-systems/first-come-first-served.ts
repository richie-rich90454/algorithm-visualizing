/**
 * first-come-first-served.ts - First Come First Served CPU Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FCFS is the simplest non-preemptive scheduler. Processes are dispatched in
 * the order they arrive, and a running process keeps the CPU until its whole
 * burst is finished. If the CPU is idle when the next process has not arrived,
 * an idle gap is inserted into the timeline. This removes all decision making
 * but can suffer from the convoy effect when a long job sits ahead of short
 * ones.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p log p) for the arrival sort, plus O(p) for the simulation
 *   Space: O(p) for process state and the Gantt log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per process shows its remaining burst.
 *   - The dispatched process is CYAN, finished ones GREEN.
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

/** Normalize possibly absent input into well-formed processes. */
function normalize(input: unknown): Proc[] {
    const task = (input as { processes?: Array<{ id?: string; burst?: number; arrival?: number }> } | null) ?? {};
    const specs = Array.isArray(task.processes)
        ? task.processes
        : [
              { id: "P1", burst: 5, arrival: 0 },
              { id: "P2", burst: 3, arrival: 1 },
              { id: "P3", burst: 4, arrival: 2 },
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
    const order = processes
        .map((process, index) => ({ process, index }))
        .sort((a, b) => a.process.arrival - b.process.arrival || a.index - b.index);
    const segments: Segment[] = [];
    const completion: Record<string, number> = {};
    let time = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(processes, remaining, null),
        edges: [],
        description: `FCFS with ${processes.length} process(es); dispatch strictly in arrival order.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: processes.length, time: 0, gantt: [] as string[] },
    };
    let step = 1;

    for (const { process } of order) {
        if (process.arrival > time) {
            segments.push({ id: "IDLE", start: time, end: process.arrival });
            time = process.arrival;
        }
        const start = time;
        time += process.burst;
        segments.push({ id: process.id, start, end: time });
        completion[process.id] = time;
        remaining[process.id] = 0;
        yield {
            stepNumber: step,
            entities: makeCells(processes, remaining, process.id),
            edges: [],
            description: `Dispatch ${process.id} from ${start} to ${time}; it arrived at ${process.arrival} and ran ${process.burst} unit(s).`,
            codeLineNumber: 2,
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
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: processes.length,
            time,
            gantt: ganttStrings(segments),
            order: order.map((item) => item.process.id),
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
            "FCFS treats the CPU like a single checkout line: whoever arrived first is served first and is never interrupted. The scheduler only has to sort arrivals and run each job to completion, so it is trivial to implement and easy to explain. Its weakness is that a long job at the front makes every short job behind it wait, a behavior called the convoy effect.",
        invariants: [
            "Processes are dispatched in nondecreasing arrival order, with input order breaking ties.",
            "A dispatched process runs to completion without preemption.",
            "Turnaround equals completion time minus arrival time, and waiting equals turnaround minus burst.",
        ],
        correctness:
            "The algorithm sorts processes by arrival time, which is exactly the first-come-first-served rule, then appends an idle segment whenever the CPU would otherwise be empty. Each process runs for exactly its burst, so the recorded completion time is the clock value after that run. Turnaround and waiting are computed by their definitions, and the accompanying test replays the same arrival-order simulation independently and checks the Gantt chart and accounting identities.",
        complexityRationale:
            "Sorting p processes by arrival costs O(p log p); the single pass that builds the timeline is O(p). All per-process counters and the Gantt log take O(p) space.",
        uses: [
            "Batch systems where jobs truly are processed in submission order",
            "A baseline policy used to measure the benefit of smarter schedulers",
            "Print queues and simple FIFO task runners",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter on CPU Scheduling",
            "Tanenbaum, Modern Operating Systems, Chapter 2",
        ],
        workedExample:
            "With P1 arriving at 0 with burst 5, P2 at 1 with burst 3, and P3 at 2 with burst 4, the timeline is P1 from 0 to 5, P2 from 5 to 8, and P3 from 8 to 12. Waiting times are 0, 4, and 6, so the average waiting time is 10 over three processes.",
    },
    id: "first-come-first-served",
    name: "First Come First Served",
    category: "production-systems",
    complexity: { time: "O(p log p)", space: "O(p)" },
    defaultInput: {
        processes: [
            { id: "P1", burst: 5, arrival: 0 },
            { id: "P2", burst: 3, arrival: 1 },
            { id: "P3", burst: 4, arrival: 2 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read each process with its arrival time and burst",
        "sort processes by arrival time, breaking ties by input order",
        "set the clock to zero and keep every process unfinished",
        "if the CPU is idle, advance the clock to the next arrival and log idle time",
        "run the chosen process to completion and log its Gantt segment",
        "record its completion time as the current clock",
        "compute turnaround as completion minus arrival and waiting as turnaround minus burst",
        "done: report the timeline and average waiting time",
    ],
};

export default module;
