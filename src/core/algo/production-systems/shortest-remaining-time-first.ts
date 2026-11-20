/**
 * shortest-remaining-time-first.ts - Shortest Remaining Time First Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SRTF is the preemptive counterpart of shortest job first. At every unit of
 * time it looks at the processes that have arrived and runs whichever one has
 * the least remaining burst. A newly arrived short job can therefore take the
 * CPU away from a longer running job. The simulation advances one unit at a
 * time and merges consecutive units of the same process into one Gantt segment.
 * Ties are broken by arrival time and then input order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * p) for T time units and p processes with a linear scan
 *   Space: O(p + T) for process state and the Gantt log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per process shows its remaining burst.
 *   - The process holding the CPU this unit is CYAN, finished ones GREEN.
 *   - meta carries the merged Gantt timeline and derived accounting times.
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
              { id: "P1", burst: 7, arrival: 0 },
              { id: "P2", burst: 2, arrival: 2 },
              { id: "P3", burst: 4, arrival: 4 },
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
    const completion: Record<string, number> = {};
    let finishedCount = 0;
    for (const process of processes) {
        remaining[process.id] = process.burst;
        if (process.burst === 0) {
            completion[process.id] = process.arrival;
            finishedCount += 1;
        }
    }
    const totalBurst = processes.reduce((sum, process) => sum + process.burst, 0);
    const segments: Segment[] = [];
    let time = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(processes, remaining, null),
        edges: [],
        description: `SRTF with ${processes.length} process(es); recompute the shortest remaining burst every time unit.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: processes.length, time: 0, gantt: [] as string[] },
    };
    let step = 1;

    let guard = 0;
    const guardLimit = totalBurst + processes.length + 1;
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
            const candidateLeft = remaining[candidate.id] ?? 0;
            const currentLeft = remaining[current.id] ?? 0;
            if (
                candidateLeft < currentLeft ||
                (candidateLeft === currentLeft && candidate.arrival < current.arrival) ||
                (candidateLeft === currentLeft &&
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
        remaining[chosen.id] = (remaining[chosen.id] ?? 0) - 1;
        time += 1;
        const last = segments[segments.length - 1];
        if (last && last.id === chosen.id && last.end === time - 1) {
            last.end = time;
        } else {
            segments.push({ id: chosen.id, start: time - 1, end: time });
        }
        if ((remaining[chosen.id] ?? 0) === 0) {
            completion[chosen.id] = time;
            finishedCount += 1;
        }
        yield {
            stepNumber: step,
            entities: makeCells(processes, remaining, chosen.id),
            edges: [],
            description: `Time ${time - 1} to ${time}: ran ${chosen.id} (${remaining[chosen.id]} unit(s) left) with the shortest remaining burst.`,
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
            "SRTF keeps asking the same question at every instant: of the jobs that have arrived, which one has the least work left? That job gets the CPU for the next unit. Because the answer is recomputed continuously, a short job that arrives while a longer one is running immediately seizes the CPU. This gives the shortest average waiting time among preemptive policies when the exact remaining times are known.",
        invariants: [
            "At each time unit, the running process has the minimum remaining burst among arrived processes.",
            "Remaining bursts decrease by exactly one for the running process each unit.",
            "Consecutive units of the same process are merged into a single Gantt segment.",
        ],
        correctness:
            "The unit-by-unit scan implements the shortest-remaining-time rule exactly, including preemption when a newly arrived job becomes the minimum. Merging adjacent segments only changes presentation, not the timeline: the sum of segment lengths equals total CPU time. Completion is recorded at the unit when a process's remaining burst reaches zero, so waiting and turnaround follow from their definitions; the test replays the same unit simulation independently and checks these values.",
        complexityRationale:
            "The simulation runs for T time units, and each unit scans p processes to find the minimum, giving O(T * p) time; the Gantt log holds at most T segments, so space is O(p + T). A priority queue would reduce each unit to O(log p).",
        uses: [
            "An ideal benchmark for minimum average response time",
            "Scheduling real-time tasks with known execution times",
            "A teaching example of preemptive versus non-preemptive policies",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter on CPU Scheduling",
            "Kleinrock, Queueing Systems, Volume 1",
        ],
        workedExample:
            "With P1 arriving at 0 with burst 7, P2 at 2 with burst 2, and P3 at 4 with burst 4, the timeline is P1 from 0 to 2, P2 from 2 to 4, P3 from 4 to 8, and P1 from 8 to 13. Both later arrivals have less work remaining than P1 at the moment they appear, so P1 is preempted twice even though it started first.",
    },
    id: "shortest-remaining-time-first",
    name: "Shortest Remaining Time First",
    category: "production-systems",
    complexity: { time: "O(T * p)", space: "O(p + T)" },
    defaultInput: {
        processes: [
            { id: "P1", burst: 7, arrival: 0 },
            { id: "P2", burst: 2, arrival: 2 },
            { id: "P3", burst: 4, arrival: 4 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read each process with its arrival time and total burst",
        "set the clock to zero and copy each burst into a remaining counter",
        "while some remaining counter is positive",
        "among arrived processes pick the one with the smallest remaining counter",
        "if none has arrived, jump the clock to the next arrival and log idle time",
        "run the chosen process for one time unit and decrement its counter",
        "merge the unit into the last Gantt segment when the process is unchanged",
        "done: report the merged timeline and average waiting time",
    ],
};

export default module;
