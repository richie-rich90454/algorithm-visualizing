/**
 * priority-scheduling.ts - Non-preemptive Priority CPU Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Every process carries an explicit priority number, and the scheduler picks
 * the arrived process with the smallest number (the highest priority) whenever
 * the CPU becomes free. This variant is non-preemptive: a running process keeps
 * the CPU until its burst finishes even if a higher-priority process arrives in
 * the meantime. Ties are broken by arrival time and then by input order. A
 * fixed priority assignment can starve low-priority work, which aging schemes
 * are designed to prevent.
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
 *   - One grid cell per process shows its priority and remaining burst.
 *   - The chosen process is CYAN; finished ones GREEN.
 *   - meta carries the Gantt timeline and the derived accounting times.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Proc {
    id: string;
    burst: number;
    arrival: number;
    priority: number;
}

interface Segment {
    id: string;
    start: number;
    end: number;
}

function normalize(input: unknown): Proc[] {
    const task = (
        input as { processes?: Array<{ id?: string; burst?: number; arrival?: number; priority?: number }> } | null
    ) ?? {};
    const specs = Array.isArray(task.processes)
        ? task.processes
        : [
              { id: "P1", burst: 4, arrival: 0, priority: 2 },
              { id: "P2", burst: 2, arrival: 0, priority: 1 },
              { id: "P3", burst: 3, arrival: 0, priority: 3 },
          ];
    return specs.map((spec, index) => ({
        id: String(spec.id ?? `P${index + 1}`),
        burst: Math.max(0, Math.floor(Number(spec.burst) || 0)),
        arrival: Math.max(0, Math.floor(Number(spec.arrival) || 0)),
        priority: Math.floor(Number(spec.priority) || 0),
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
            label: `${process.id} p${process.priority}: ${left}`,
            value: left,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: 0,
                col: index,
                id: process.id,
                remaining: left,
                arrival: process.arrival,
                priority: process.priority,
            },
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
        description: `Priority scheduling over ${processes.length} process(es); a lower number means higher priority.`,
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
                candidate.priority < current.priority ||
                (candidate.priority === current.priority && candidate.arrival < current.arrival) ||
                (candidate.priority === current.priority &&
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
            description: `Dispatch ${chosen.id} from ${start} to ${time}; it holds priority ${chosen.priority}, lowest among arrived jobs.`,
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
            "Priority scheduling gives each job a rank and always serves the highest rank that is ready. Think of an emergency room: patients with more urgent conditions are seen first regardless of when they arrived. In this non-preemptive version, once a doctor starts with a patient they finish that patient before looking at the queue again.",
        invariants: [
            "Only processes whose arrival time is at or before the clock can be chosen.",
            "The chosen process has the smallest priority number among eligible processes.",
            "Numbers are static, so a lower number always outranks a higher one whenever both are waiting.",
        ],
        correctness:
            "The scan selects the arrived process with the smallest priority number, breaking ties by arrival and input order, which is the non-preemptive priority rule. Idle jumps move the clock to the next arrival so that no eligible process is skipped. Each selected process runs for its full burst and its completion time is recorded; the test verifies the resulting Gantt chart and accounting figures against an independent replay and checks that a higher-priority job is served first.",
        complexityRationale:
            "At most p dispatches each scan p processes, giving O(p^2) time with a linear scan or O(p log p) with a heap. Storing the process table, remaining counters, and Gantt log requires O(p) space.",
        uses: [
            "Operating system process and thread scheduling",
            "Network packet forwarding with differentiated service classes",
            "Job queues that distinguish urgent from background work",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter on CPU Scheduling",
            "Tanenbaum, Modern Operating Systems, Chapter 2",
        ],
        workedExample:
            "With P1 priority 2 burst 4, P2 priority 1 burst 2, and P3 priority 3 burst 3 all arriving at 0, priority scheduling runs P2 from 0 to 2, P1 from 2 to 6, and P3 from 6 to 9. The smallest priority number always goes first.",
    },
    id: "priority-scheduling",
    name: "Priority Scheduling",
    category: "production-systems",
    complexity: { time: "O(p^2)", space: "O(p)" },
    defaultInput: {
        processes: [
            { id: "P1", burst: 4, arrival: 0, priority: 2 },
            { id: "P2", burst: 2, arrival: 0, priority: 1 },
            { id: "P3", burst: 3, arrival: 0, priority: 3 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read each process with arrival, burst, and priority number",
        "set the clock to zero and mark every process unfinished",
        "while some process is unfinished",
        "among arrived unfinished processes pick the smallest priority number",
        "if none has arrived, jump the clock to the next arrival and log idle time",
        "run the chosen process to completion and log its Gantt segment",
        "record its completion time as the current clock",
        "done: report the timeline and average waiting time",
    ],
};

export default module;
