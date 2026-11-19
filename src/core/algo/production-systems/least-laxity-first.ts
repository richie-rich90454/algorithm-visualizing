/**
 * least-laxity-first.ts - Least Laxity First Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Least laxity first is a preemptive real-time scheduler. At each instant the
 * laxity (or slack) of a ready job is its deadline minus its remaining burst
 * minus the current time. The scheduler always runs the ready job with the
 * smallest laxity, which is the one in the greatest danger of missing its
 * deadline. A negative laxity means a deadline can no longer be met.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * p) for T time units and p jobs (linear scan for minimum laxity)
 *   Space: O(p + T) for job state and the recorded schedule
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per job shows its remaining burst and current laxity.
 *   - The running job is CYAN, a job that missed its deadline is RED.
 *   - meta carries the laxity history, the timeline, and missed deadlines.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Job {
    id: string;
    burst: number;
    deadline: number;
    arrival: number;
}

function normalize(input: unknown): Job[] {
    const task = (input as { jobs?: Array<{ id?: string; burst?: number; deadline?: number; arrival?: number }> } | null) ?? {};
    const specs = Array.isArray(task.jobs) && task.jobs.length > 0
        ? task.jobs
        : [
              { id: "J1", burst: 3, deadline: 5, arrival: 0 },
              { id: "J2", burst: 2, deadline: 4, arrival: 0 },
              { id: "J3", burst: 2, deadline: 7, arrival: 1 },
          ];
    return specs.map((spec, index) => ({
        id: String(spec.id ?? `J${index + 1}`),
        burst: Math.max(0, Math.floor(Number(spec.burst) || 0)),
        deadline: Math.max(0, Math.floor(Number(spec.deadline) || 0)),
        arrival: Math.max(0, Math.floor(Number(spec.arrival) || 0)),
    }));
}

function makeCells(jobs: Job[], remaining: number[], laxities: number[], running: number, missed: boolean[]): VisualEntity[] {
    return jobs.map((job, index) => {
        const left = remaining[index] ?? 0;
        let state: EntityState = "idle";
        if (missed[index]) {
            state = "error";
        } else if (left === 0) {
            state = "sorted";
        } else if (index === running) {
            state = "active";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${job.id}: ${left} lax ${laxities[index] ?? 0}`,
            value: left,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: 0,
                col: index,
                id: job.id,
                deadline: job.deadline,
                remaining: left,
                laxity: laxities[index] ?? 0,
            },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const jobs = normalize(input);
    const remaining = jobs.map((job) => job.burst);
    const missed = jobs.map(() => false);
    const timeline: string[] = [];
    const laxHistory: number[] = [];
    let time = 0;

    const laxitiesNow = (clock: number): number[] =>
        jobs.map((job, i) =>
            (remaining[i] ?? 0) > 0 ? job.deadline - clock - (remaining[i] ?? 0) : 0,
        );

    yield {
        stepNumber: 0,
        entities: makeCells(jobs, remaining, laxitiesNow(time), -1, missed),
        edges: [],
        description: `Least laxity first over ${jobs.length} job(s); at time 0 slack is deadline minus burst.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: jobs.length,
            time: 0,
            deadlines: jobs.map((job) => job.deadline),
            arrivals: jobs.map((job) => job.arrival),
            timeline,
            missed: [] as string[],
        },
    };
    let step = 1;

    const totalBurst = remaining.reduce((sum, value) => sum + value, 0);
    let guard = 0;
    while (remaining.some((value) => value > 0) && guard < totalBurst + jobs.length * 2 + 1) {
        guard += 1;
        let choice = -1;
        let bestLaxity = Infinity;
        for (let i = 0; i < jobs.length; i += 1) {
            if ((remaining[i] ?? 0) <= 0 || (jobs[i]?.arrival ?? 0) > time) {
                continue;
            }
            const laxity = (jobs[i]?.deadline ?? 0) - (remaining[i] ?? 0) - time;
            if (laxity < bestLaxity) {
                bestLaxity = laxity;
                choice = i;
            }
        }
        if (choice < 0) {
            const nextArrival = Math.min(
                ...jobs.map((job, i) => ((remaining[i] ?? 0) > 0 ? job.arrival : Infinity)),
            );
            if (!Number.isFinite(nextArrival)) {
                break;
            }
            time = nextArrival;
            continue;
        }
        remaining[choice] = (remaining[choice] ?? 0) - 1;
        timeline.push(jobs[choice]?.id ?? `J${choice}`);
        laxHistory.push(bestLaxity);
        time += 1;
        if ((remaining[choice] ?? 0) === 0 && time > (jobs[choice]?.deadline ?? 0)) {
            missed[choice] = true;
        }
        yield {
            stepNumber: step,
            entities: makeCells(jobs, remaining, laxitiesNow(time), choice, missed),
            edges: [],
            description: `Time ${time - 1} to ${time}: ${jobs[choice]?.id} had the smallest laxity ${bestLaxity} and ran.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 1,
                cols: jobs.length,
                time,
                deadlines: jobs.map((job) => job.deadline),
                arrivals: jobs.map((job) => job.arrival),
                timeline: [...timeline],
                laxities: laxitiesNow(time),
                missed: jobs.filter((_job, i) => missed[i]).map((job) => job.id),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(jobs, remaining, laxitiesNow(time), -1, missed),
        edges: [],
        description: `All jobs finished at time ${time}; ${missed.filter(Boolean).length} deadline(s) missed.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 1,
            cols: jobs.length,
            time,
            deadlines: jobs.map((job) => job.deadline),
            arrivals: jobs.map((job) => job.arrival),
            timeline,
            laxHistory,
            missed: jobs.filter((_job, i) => missed[i]).map((job) => job.id),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Slack tells you how long a job can wait before it is in danger. At every moment least laxity first runs the job with the least slack because that job has the smallest margin for error. The choice is recomputed after every time unit, so a newly arrived urgent job can immediately take the processor from a less urgent one.",
        invariants: [
            "A ready job's laxity equals its deadline minus its remaining burst minus the current time.",
            "Only jobs that have arrived and still need processor time are eligible.",
            "At each instant the chosen job has the minimum laxity among eligible jobs, with input order breaking ties.",
        ],
        correctness:
            "Computing laxity directly from its definition and taking a strict minimum guarantees the chosen job is the most urgent one at that instant. Each time unit reduces exactly one job's remaining burst, so the loop ends after the total burst and the timeline is a valid schedule. A job is marked missed only when it finishes after its deadline, matching the standard feasibility definition. The companion test replays an independent simulation, checks the minimum-laxity invariant at every step, and verifies the missed-deadline set.",
        complexityRationale:
            "Each of the T time units scans p jobs to find the minimum laxity, giving O(T * p). The timeline, laxity history, and per-job state occupy O(p + T) space.",
        uses: [
            "Hard real-time scheduling of periodic tasks",
            "Operating-system process dispatch with deadlines",
            "A baseline for comparing feasible real-time schedules",
        ],
        references: [
            "Liu and Layland, Scheduling Algorithms for Multiprogramming in a Hard-Real-Time Environment, 1973",
            "Buttazzo, Hard Real-Time Computing Systems, chapter on dynamic scheduling",
        ],
        workedExample:
            "At time 0, J1 has burst 3 and deadline 5 so laxity 2, while J2 has burst 2 and deadline 4 so laxity 2 as well; the tie goes to J1. After J1 runs one unit its laxity rises to 3, and J2 with laxity 2 becomes the choice, which keeps the job nearest its deadline moving.",
    },
    id: "least-laxity-first",
    name: "Least Laxity First",
    category: "production-systems",
    complexity: { time: "O(T * p)", space: "O(p + T)" },
    defaultInput: {
        jobs: [
            { id: "J1", burst: 3, deadline: 5, arrival: 0 },
            { id: "J2", burst: 2, deadline: 4, arrival: 0 },
            { id: "J3", burst: 2, deadline: 7, arrival: 1 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read each job with its burst, deadline, and arrival time",
        "set the clock to zero and keep every job unfinished",
        "compute the laxity of each arrived unfinished job as deadline minus remaining minus clock",
        "run the job with the smallest laxity for one time unit",
        "if no job has arrived, advance the clock to the next arrival",
        "record a missed deadline when a job finishes after its deadline",
        "advance the clock and repeat until all jobs finish",
        "done: report the timeline and the set of missed deadlines",
    ],
};

export default module;
