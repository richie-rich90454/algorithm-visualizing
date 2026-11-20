/**
 * earliest-deadline-first.ts - Earliest Deadline First (EDF) Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * EDF is a dynamic-priority, preemptive scheduler for a single processor. At
 * every instant it runs the released job whose absolute deadline is soonest.
 * Unlike rate monotonic (fixed priorities by period), priorities change as
 * jobs are released, so EDF can meet any periodic task set whose total
 * utilization is at most one when deadlines equal periods.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * n) over T time units and n tasks
 *   Space: O(T) for the recorded schedule
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per simulated time unit; its height is the task chosen (0 idle).
 *   - The current slot is highlighted; a slot with no runnable job is idle.
 *   - meta carries the full schedule, missed-deadline count and utilization.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TaskDef {
    period: number;
    exec: number;
}

interface Job {
    task: number;
    release: number;
    deadline: number;
    remaining: number;
}

/** Build the timeline bars for the schedule produced so far. */
function makeBars(schedule: number[], current: number, done: boolean): VisualEntity[] {
    return schedule.map((task, index) => {
        let state: EntityState = "idle";
        if (task < 0) {
            state = "unvisited";
        } else if (done && index === schedule.length - 1) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `slot-${index}`,
            type: "bar" as const,
            label: `t${index}:${task < 0 ? "idle" : `T${task}`}`,
            value: task < 0 ? 0 : task + 1,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, task, time: index },
        };
    });
}

/** Simulate EDF over a finite horizon, emitting one frame per time unit. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { tasks?: TaskDef[]; duration?: number } | null) ?? {};
    const tasks: TaskDef[] = (task.tasks ?? [
        { period: 4, exec: 1 },
        { period: 5, exec: 2 },
        { period: 6, exec: 1 },
    ]).map((t) => ({
        period: Math.max(1, Math.floor(Number(t.period)) || 1),
        exec: Math.max(1, Math.floor(Number(t.exec)) || 1),
    }));
    const horizon = Math.max(...tasks.map((t) => t.period));
    const duration = Math.min(60, Math.max(1, Math.floor(Number(task.duration ?? horizon * 2)) || horizon * 2));
    const utilization = tasks.reduce((sum, t) => sum + t.exec / t.period, 0);

    let jobs: Job[] = [];
    const schedule: number[] = [];
    let misses = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Scheduling ${tasks.length} periodic task(s) with EDF for ${duration} time unit(s); utilization ${utilization.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { duration, utilization, misses: 0, schedule: [] },
    };
    step += 1;

    for (let t = 0; t < duration; t += 1) {
        tasks.forEach((def, index) => {
            if (t % def.period === 0) {
                jobs.push({ task: index, release: t, deadline: t + def.period, remaining: def.exec });
            }
        });

        // A job whose deadline has passed with work left is a missed deadline.
        for (const job of jobs) {
            if (job.deadline < t && job.remaining > 0) {
                misses += 1;
                job.remaining = 0;
            }
        }
        jobs = jobs.filter((job) => job.remaining > 0);

        let chosen = -1;
        let bestDeadline = Number.POSITIVE_INFINITY;
        jobs.forEach((job, index) => {
            if (job.deadline < bestDeadline) {
                bestDeadline = job.deadline;
                chosen = index;
            }
        });

        if (chosen >= 0) {
            const running = jobs[chosen];
            if (running) {
                running.remaining -= 1;
                schedule.push(running.task);
            } else {
                schedule.push(-1);
            }
        } else {
            schedule.push(-1);
        }

        yield {
            stepNumber: step,
            entities: makeBars(schedule, schedule.length - 1, false),
            edges: [],
            description: `Time ${t}: ${chosen >= 0 ? `run task ${schedule[schedule.length - 1]} (deadline ${bestDeadline})` : "processor idle"}; ${misses} deadline(s) missed so far.`,
            codeLineNumber: chosen >= 0 ? 4 : 3,
            layout: "array",
            meta: { duration, utilization, misses, schedule: [...schedule] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(schedule, -1, true),
        edges: [],
        description: `EDF finished ${duration} unit(s) with ${misses} missed deadline(s); utilization ${utilization.toFixed(3)}.`,
        codeLineNumber: tasks.length > 0 ? 5 : 0,
        layout: "array",
        meta: { duration, utilization, misses, schedule: [...schedule], feasible: utilization <= 1 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "At every instant, look at all jobs that have arrived but are not finished, and run the one with the closest deadline. Priorities are not fixed: an urgent short job released now can preempt a longer job that started earlier. This lets the processor adapt to changing urgency.",
        invariants: [
            "At each time unit the running job has the smallest absolute deadline among all pending jobs.",
            "A job's absolute deadline equals its release time plus its period (deadline equals period here).",
            "Total utilization is the sum of execution time divided by period over all tasks.",
        ],
        correctness:
            "For synchronous periodic tasks with deadline equal to period, EDF is optimal: if the total utilization is at most one, EDF meets every deadline. The schedule produced here reproduces that rule preemptively each unit, so on a feasible task set no job is ever left with work past its deadline.",
        complexityRationale:
            "Each of the T simulated units releases at most n jobs and scans at most n pending jobs to find the earliest deadline, giving O(T * n) time. The recorded schedule holds one entry per unit, so space is O(T).",
        uses: [
            "Real-time operating systems with dynamic priorities",
            "Multimedia streaming where frames have playback deadlines",
            "Ethernet avionics and automotive task scheduling",
        ],
        references: [
            "Liu and Layland, Scheduling Algorithms for Multiprogramming in a Hard-Real-Time Environment, 1973",
            "Buttazzo, Hard Real-Time Computing Systems, Chapter 4",
        ],
        workedExample:
            "Tasks (period 4, exec 1), (period 5, exec 2) and (period 6, exec 1) have utilization 0.25 + 0.4 + 0.167 = 0.817. At time 0 all three are released with deadlines 4, 5 and 6, so task 0 runs first. The processor keeps choosing the smallest current deadline and no job misses its deadline.",
    },
    id: "earliest-deadline-first",
    name: "Earliest Deadline First",
    category: "production-systems",
    complexity: { time: "O(T * n)", space: "O(T)" },
    defaultInput: {
        tasks: [
            { period: 4, exec: 1 },
            { period: 5, exec: 2 },
            { period: 6, exec: 1 },
        ],
        duration: 12,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize empty job queue and empty schedule",
        "for each time unit t from zero to duration minus one",
        "release every task whose period divides t, with deadline t plus period",
        "discard jobs whose deadline passed with work remaining",
        "choose the pending job with the smallest absolute deadline",
        "run that job for one unit and record its task number",
        "if no job is pending, record an idle slot",
        "after all units, report the schedule and missed deadlines",
    ],
};

export default module;
