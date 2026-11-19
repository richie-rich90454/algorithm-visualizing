/**
 * rate-monotonic-scheduling.ts - Rate Monotonic Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rate monotonic assigns fixed priorities to periodic tasks: the shorter a
 * task's period, the higher its priority. A preemptive simulation over one
 * hyperperiod shows which jobs meet their deadlines. The utilization bound
 * gives a quick sufficient test for schedulability.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(H) over the hyperperiod H of the task periods
 *   Space: O(n) for the per-task job queues
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One cell per task shows the remaining work of its current job.
 *   - The running task is highlighted; a missed deadline is marked as an error.
 *   - meta carries the Gantt log, utilization, and deadline-miss count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RmTask {
    id: string;
    period: number;
    execution: number;
}

interface Job {
    remaining: number;
    deadline: number;
    missed: boolean;
}

/** Greatest common divisor used to build the hyperperiod. */
function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const next = x % y;
        x = y;
        y = next;
    }
    return x || 1;
}

/** Least common multiple of all task periods, capped for safe visualization. */
function hyperperiod(tasks: RmTask[]): number {
    let value = 1;
    for (const task of tasks) {
        value = (value * task.period) / gcd(value, task.period);
        if (value > 720) {
            return 720;
        }
    }
    return value;
}

/** Exact preemptive simulation of rate monotonic over one hyperperiod. */
export function simulate(tasks: RmTask[]): { gantt: string[]; misses: number; horizon: number } {
    const horizon = hyperperiod(tasks);
    const queues: Job[][] = tasks.map(() => []);
    const gantt: string[] = [];
    let misses = 0;
    for (let time = 0; time < horizon; time += 1) {
        for (let i = 0; i < tasks.length; i += 1) {
            const task = tasks[i];
            if (task && time % task.period === 0) {
                queues[i]?.push({ remaining: task.execution, deadline: time + task.period, missed: false });
            }
        }
        for (let i = 0; i < queues.length; i += 1) {
            const pending = queues[i] ?? [];
            for (const job of pending) {
                if (!job.missed && job.deadline <= time && job.remaining > 0) {
                    job.missed = true;
                    misses += 1;
                }
            }
            queues[i] = pending.filter((job) => !job.missed);
        }
        let running = -1;
        for (let i = 0; i < tasks.length; i += 1) {
            const job = queues[i]?.[0];
            if (job && job.remaining > 0) {
                running = i;
                job.remaining -= 1;
                if (job.remaining === 0) {
                    queues[i]?.shift();
                }
                break;
            }
        }
        const task = running >= 0 ? tasks[running] : undefined;
        gantt.push(task ? task.id : "idle");
    }
    for (const pending of queues) {
        for (const job of pending) {
            if (!job.missed && job.deadline <= horizon && job.remaining > 0) {
                misses += 1;
            }
        }
    }
    return { gantt, misses, horizon };
}

/** Utilization and the classic sufficient schedulability bound. */
export function utilization(tasks: RmTask[]): { used: number; bound: number; guaranteed: boolean } {
    const used = tasks.reduce((sum, task) => sum + task.execution / task.period, 0);
    const n = Math.max(1, tasks.length);
    const bound = n * (Math.pow(2, 1 / n) - 1);
    return { used, bound, guaranteed: used <= bound + 1e-9 };
}

/** Build one cell per task showing its current remaining work. */
function makeCells(tasks: RmTask[], remaining: number[], running: number, missed: number): VisualEntity[] {
    return tasks.map((task, index) => {
        const left = remaining[index] ?? 0;
        let state: EntityState = "idle";
        if (index === missed) {
            state = "error";
        } else if (index === running) {
            state = "comparing";
        } else if (left === 0) {
            state = "sorted";
        }
        return {
            id: `task-${index}`,
            type: "cell" as const,
            label: `${task.id}: ${left}/${task.execution} (T=${task.period})`,
            value: left,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, remaining: left, period: task.period },
        };
    });
}

/** The rate monotonic generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { tasks?: RmTask[] } | null) ?? {};
    const tasks: RmTask[] = Array.isArray(task.tasks) && task.tasks.length > 0
        ? task.tasks
              .map((value) => ({
                  id: String(value.id),
                  period: Math.max(1, Math.floor(value.period)),
                  execution: Math.max(0, Math.floor(value.execution)),
              }))
              .sort((a, b) => a.period - b.period)
        : [
              { id: "A", period: 4, execution: 1 },
              { id: "B", period: 6, execution: 1 },
              { id: "C", period: 12, execution: 2 },
          ];

    const metrics = utilization(tasks);
    const result = simulate(tasks);
    const remaining = tasks.map((value) => value.execution);
    const missedTask = new Set<number>();

    yield {
        stepNumber: 0,
        entities: makeCells(tasks, remaining, -1, -1),
        edges: [],
        description: `Rate monotonic over ${tasks.length} task(s), ordered by period; utilization ${metrics.used.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: tasks.length,
            horizon: result.horizon,
            utilization: metrics.used,
            bound: metrics.bound,
            guaranteed: metrics.guaranteed,
            gantt: [] as string[],
            misses: 0,
        },
    };

    const queues: Job[][] = tasks.map(() => []);
    let step = 1;
    for (let time = 0; time < result.horizon; time += 1) {
        for (let i = 0; i < tasks.length; i += 1) {
            const value = tasks[i];
            if (value && time % value.period === 0) {
                queues[i]?.push({ remaining: value.execution, deadline: time + value.period, missed: false });
            }
        }
        for (let i = 0; i < queues.length; i += 1) {
            const pending = queues[i] ?? [];
            for (const job of pending) {
                if (!job.missed && job.deadline <= time && job.remaining > 0) {
                    job.missed = true;
                    missedTask.add(i);
                }
            }
            queues[i] = pending.filter((job) => !job.missed);
        }
        let running = -1;
        for (let i = 0; i < tasks.length; i += 1) {
            const job = queues[i]?.[0];
            if (job && job.remaining > 0) {
                running = i;
                job.remaining -= 1;
                if (job.remaining === 0) {
                    queues[i]?.shift();
                }
                break;
            }
        }
        for (let i = 0; i < tasks.length; i += 1) {
            remaining[i] = queues[i]?.[0]?.remaining ?? 0;
        }
        const name = running >= 0 ? (tasks[running]?.id ?? "idle") : "idle";
        yield {
            stepNumber: step,
            entities: makeCells(tasks, remaining, running, -1),
            edges: [],
            description: `Time ${time}: ${name} runs; shortest period has priority.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: tasks.length,
                time,
                gantt: result.gantt.slice(0, time + 1),
                misses: missedTask.size,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(tasks, tasks.map(() => 0), -1, -1),
        edges: [],
        description: `Hyperperiod complete: ${result.misses} deadline miss(es); ${metrics.guaranteed ? "utilization bound satisfied" : "bound not satisfied"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: tasks.length,
            horizon: result.horizon,
            utilization: metrics.used,
            bound: metrics.bound,
            guaranteed: metrics.guaranteed,
            gantt: result.gantt,
            misses: result.misses,
            done: true,
        },
    };
}

/** The rate monotonic module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Give the task with the shortest period the highest fixed priority and let it preempt longer tasks whenever it becomes ready. Rate monotonic is simple to implement because priorities never change at runtime. As long as total CPU utilization stays below a known bound, every job is guaranteed to finish before its next release.",
        invariants: [
            "Priorities are fixed and ordered by increasing period.",
            "At any instant the highest-priority ready job is the one executing.",
            "A job is released at every multiple of its period and must finish before its deadline.",
        ],
        correctness:
            "Rate monotonic is optimal among fixed-priority policies: if any fixed-priority assignment meets all deadlines, the rate monotonic assignment does too. The sufficient utilization bound n times (2 to the power 1/n minus 1) guarantees schedulability for task sets below it. The simulation reproduces the exact preemptive schedule by releasing jobs at period multiples, running the highest-priority pending job, and flagging any job whose deadline passes with work remaining.",
        complexityRationale:
            "The simulation advances one time unit at a time across the hyperperiod H, so it takes O(H) time. Each task keeps a queue of its pending jobs, giving O(n) space beyond the Gantt log of length H.",
        uses: [
            "Fixed-priority real-time operating systems",
            "Embedded control loops with periodic sensor sampling",
            "Hard-deadline task sets where runtime priorities must stay simple",
        ],
        references: [
            "Liu and Layland, Scheduling Algorithms for Multiprogramming in a Hard-Real-Time Environment, 1973",
            "Buttazzo, Hard Real-Time Computing Systems, Chapter 3",
        ],
        workedExample:
            "Tasks A(period 4, cost 1), B(6, 1), and C(12, 2) have utilization 0.25 + 0.167 + 0.167 = 0.583, below the three-task bound of about 0.780. Over a hyperperiod of 12, the shorter-period tasks always preempt C, and no job misses its deadline.",
    },
    id: "rate-monotonic-scheduling",
    name: "Rate Monotonic Scheduling",
    category: "production-systems",
    complexity: { time: "O(H)", space: "O(n)" },
    defaultInput: {
        tasks: [
            { id: "A", period: 4, execution: 1 },
            { id: "B", period: 6, execution: 1 },
            { id: "C", period: 12, execution: 2 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "sort tasks by increasing period to assign priorities",
        "compute utilization and the sufficient schedulability bound",
        "for each time unit in the hyperperiod release jobs due now",
        "flag any pending job whose deadline has already passed",
        "run the highest priority job with remaining work",
        "record the scheduled task in the Gantt log",
        "done: report deadline misses and the utilization verdict",
    ],
};

export default module;
