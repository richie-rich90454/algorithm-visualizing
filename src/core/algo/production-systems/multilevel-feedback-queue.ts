/**
 * multilevel-feedback-queue.ts - Multilevel Feedback Queue Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MLFQ uses several ready queues with decreasing priority and increasing time
 * quantum. A new process enters the top queue. If it uses a whole quantum
 * without finishing, it is demoted to the next lower queue; a process that
 * yields early keeps its high-priority place. Queues are served in strict
 * priority order, and the lowest queue runs in round-robin order. This lets
 * short interactive jobs respond quickly while long batch jobs drift downward.
 * This teaching model omits priority aging.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d * q) where d is the number of dispatches and q the queue count
 *   Space: O(p + q) for processes and the ready queues
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per process; its row is its current queue level.
 *   - The dispatched process is CYAN, demoted ones change row, finished GREEN.
 *   - meta carries the Gantt timeline, the final queue of each process, and
 *     the derived waiting / turnaround times.
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
              { id: "P2", burst: 2, arrival: 1 },
              { id: "P3", burst: 8, arrival: 2 },
          ];
    return specs.map((spec, index) => ({
        id: String(spec.id ?? `P${index + 1}`),
        burst: Math.max(0, Math.floor(Number(spec.burst) || 0)),
        arrival: Math.max(0, Math.floor(Number(spec.arrival) || 0)),
    }));
}

function quantaOf(input: unknown, levels: number): number[] {
    const task = input as { quanta?: number[] } | null;
    if (Array.isArray(task?.quanta) && task.quanta.length === levels) {
        const cleaned = task.quanta.map((value) => Math.max(1, Math.floor(Number(value) || 1)));
        if (cleaned.length === levels) {
            return cleaned;
        }
    }
    return Array.from({ length: levels }, (_, index) => 2 ** index);
}

function makeCells(
    processes: Proc[],
    remaining: Record<string, number>,
    queueOf: Record<string, number>,
    running: string | null,
): VisualEntity[] {
    return processes.map((process, index) => {
        const left = remaining[process.id] ?? 0;
        const queue = queueOf[process.id] ?? 0;
        let state: EntityState = "idle";
        if (left === 0) {
            state = "sorted";
        } else if (process.id === running) {
            state = "active";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${process.id} q${queue}: ${left}`,
            value: left,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: queue, col: index, id: process.id, remaining: left, queue },
        };
    });
}

function ganttStrings(log: Segment[]): string[] {
    return log.map((segment) => `${segment.id}:${segment.start}-${segment.end}`);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const processes = normalize(input);
    const task = (input as { levels?: number; quanta?: number[] } | null) ?? {};
    const levels = Math.max(1, Math.min(8, Math.floor(Number(task.levels) || 3)));
    const quanta = quantaOf(input, levels);
    const remaining: Record<string, number> = {};
    const queueOf: Record<string, number> = {};
    const admitted = new Set<string>();
    const completion: Record<string, number> = {};
    let finishedCount = 0;
    for (const process of processes) {
        remaining[process.id] = process.burst;
        queueOf[process.id] = 0;
        if (process.burst === 0) {
            completion[process.id] = process.arrival;
            finishedCount += 1;
        }
    }
    const queues: string[][] = Array.from({ length: levels }, () => []);
    const segments: Segment[] = [];
    const totalBurst = processes.reduce((sum, process) => sum + process.burst, 0);
    let time = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(processes, remaining, queueOf, null),
        edges: [],
        description: `MLFQ with ${levels} queue(s), quanta [${quanta.join(", ")}]; new jobs enter the top queue.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: levels,
            cols: processes.length,
            time: 0,
            gantt: [] as string[],
            queueOf: processes.map((process) => queueOf[process.id] ?? 0),
        },
    };
    let step = 1;

    let guard = 0;
    const guardLimit = totalBurst * levels + processes.length * levels + 1;
    while (finishedCount < processes.length && guard < guardLimit) {
        guard += 1;
        for (const process of processes) {
            if (!admitted.has(process.id) && process.arrival <= time && (remaining[process.id] ?? 0) > 0) {
                admitted.add(process.id);
                queues[0]?.push(process.id);
                queueOf[process.id] = 0;
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
        const slice = Math.min(quanta[level] ?? 1, remaining[id] ?? 0);
        const start = time;
        time += slice;
        remaining[id] = (remaining[id] ?? 0) - slice;
        const last = segments[segments.length - 1];
        if (last && last.id === id && last.end === start) {
            last.end = time;
        } else {
            segments.push({ id, start, end: time });
        }
        if ((remaining[id] ?? 0) === 0) {
            completion[id] = time;
            finishedCount += 1;
        } else if (level < levels - 1) {
            const next = level + 1;
            queues[next]?.push(id);
            queueOf[id] = next;
        } else {
            queues[level]?.push(id);
        }
        yield {
            stepNumber: step,
            entities: makeCells(processes, remaining, queueOf, id),
            edges: [],
            description: `Ran ${id} from ${start} to ${time} in queue ${level} for ${slice} unit(s); ${
                (remaining[id] ?? 0) === 0 ? "finished" : level < levels - 1 ? "demoted" : "requeued"
            }.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: levels,
                cols: processes.length,
                time,
                gantt: ganttStrings(segments),
                queueOf: processes.map((process) => queueOf[process.id] ?? 0),
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
        entities: makeCells(processes, remaining, queueOf, null),
        edges: [],
        description: `All processes finished at time ${time}; average waiting time ${(waitSum / count).toFixed(2)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: levels,
            cols: processes.length,
            time,
            gantt: ganttStrings(segments),
            queueOf: processes.map((process) => queueOf[process.id] ?? 0),
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
            "MLFQ is like a set of priority lanes where jobs can be pushed down when they prove to be long. Short jobs finish in the fast top lane with a tiny quantum, while a job that keeps needing more time is demoted into slower lanes with bigger quanta. Serving every higher lane completely before the next one keeps interactive work responsive, and round robin in the bottom lane shares the remaining work fairly.",
        invariants: [
            "A job that consumes a full quantum at a level below the bottom is demoted exactly one level.",
            "Queues are served in strict priority order: a lower queue runs only when all higher queues are empty.",
            "Total CPU time equals the sum of all bursts regardless of how jobs move between queues.",
        ],
        correctness:
            "The simulation admits arriving jobs into the top queue, always dispatches from the lowest-indexed nonempty queue, and demotes a job only after it exhausts a quantum with work remaining, which is the MLFQ rule. The bottom queue re-enqueues at the back, giving round robin there. Completion is recorded when a remaining counter hits zero; the test replays the same queue dynamics independently, checks the merged timeline against total CPU time, and confirms demotion order.",
        complexityRationale:
            "There are d dispatches and each scans at most q queues to find the highest-priority nonempty one, giving O(d * q) time. Storing p processes and q queues uses O(p + q) space.",
        uses: [
            "Interactive operating system schedulers that favor short jobs",
            "Multi-tier job and task runners in operating systems",
            "A teaching bridge between round robin and priority scheduling",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter on CPU Scheduling",
            "Nagar, Multilevel Feedback Queue Scheduling, ACM SIGOPS, 1970",
        ],
        workedExample:
            "With quanta 1, 2, 4 and P1 burst 6 at time 0 plus P2 burst 2 at time 1, P1 runs one unit in queue 0 and is demoted; P2 then runs to completion in queue 0; P1 resumes in queue 1 and is demoted to queue 2 before finishing.",
    },
    id: "multilevel-feedback-queue",
    name: "Multilevel Feedback Queue",
    category: "production-systems",
    complexity: { time: "O(d * q)", space: "O(p + q)" },
    defaultInput: {
        processes: [
            { id: "P1", burst: 6, arrival: 0 },
            { id: "P2", burst: 2, arrival: 1 },
            { id: "P3", burst: 8, arrival: 2 },
        ],
        levels: 3,
        quanta: [1, 2, 4],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read processes, queue count, and one quantum per queue",
        "place each arriving process in the top queue when it appears",
        "while some process is unfinished",
        "find the highest-priority nonempty queue and take its head",
        "run that process for the lesser of its quantum and remaining burst",
        "if it still needs time, demote it one queue or requeue it at the bottom",
        "otherwise record its completion time",
        "done: report the timeline, final queues, and average waiting time",
    ],
};

export default module;
