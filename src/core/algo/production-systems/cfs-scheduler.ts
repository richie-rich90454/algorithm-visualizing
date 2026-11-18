/**
 * cfs-scheduler.ts - Completely Fair Scheduler
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Completely Fair Scheduler models CPU sharing by giving every runnable
 * task a virtual runtime that advances more slowly for higher-priority tasks.
 * At each tick the task with the smallest virtual runtime is chosen, so the
 * scheduler continuously hands the CPU to whichever task has received the
 * least weighted service. A task's weight comes from its nice value: each step
 * of nice changes the weight by a fixed factor. The result is proportional
 * share scheduling without fixed time slices. The visualization uses a sorted
 * selection in place of the kernel's red-black tree, which is equivalent.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(ticks * taskCount) for the linear minimum selection
 *   Space: O(taskCount) for the task state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar shows a task's virtual runtime.
 *   - The bar currently holding the CPU is CYAN; higher bars are GRAY.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    name: string;
    nice: number;
    weight: number;
    vruntime: number;
    served: number;
}

/** Weight from nice value, using the standard doubling every five steps. */
function weightFromNice(nice: number): number {
    return 1024 / Math.pow(2, nice / 5);
}

/** Build one bar per task showing its virtual runtime. */
function makeBars(tasks: Task[], running: string): VisualEntity[] {
    return tasks.map((task, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${task.name} (nice ${task.nice}) vruntime ${task.vruntime.toFixed(1)}`,
        value: task.vruntime,
        state: (task.name === running ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, name: task.name, nice: task.nice },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { tasks?: Array<{ name: string; nice: number }>; ticks?: number; quantum?: number } | null) ??
        {};
    const specs = task.tasks ?? [
        { name: "alpha", nice: 0 },
        { name: "beta", nice: 5 },
        { name: "gamma", nice: -5 },
    ];
    const ticks = typeof task.ticks === "number" ? Math.max(1, Math.floor(task.ticks)) : 24;
    const quantum = typeof task.quantum === "number" ? Math.max(0.1, task.quantum) : 4;

    const tasks: Task[] = specs.map((spec) => ({
        name: spec.name,
        nice: spec.nice,
        weight: weightFromNice(spec.nice),
        vruntime: 0,
        served: 0,
    }));

    yield {
        stepNumber: 0,
        entities: makeBars(tasks, ""),
        edges: [],
        description: `Starting CFS with ${tasks.length} task(s), quantum ${quantum}; every virtual runtime is zero.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ticks: 0, running: "", vruntimes: tasks.map((t) => t.vruntime) },
    };

    let totalServed = 0;
    for (let tick = 0; tick < ticks; tick += 1) {
        let chosen = 0;
        for (let i = 1; i < tasks.length; i += 1) {
            const current = tasks[chosen];
            const candidate = tasks[i];
            if (!current || !candidate) continue;
            if (candidate.vruntime < current.vruntime - 1e-9) chosen = i;
        }
        const running = tasks[chosen];
        if (!running) break;
        running.vruntime += (quantum * 1024) / running.weight;
        running.served += quantum;
        totalServed += quantum;

        const shares: Record<string, number | string | boolean> = {};
        for (const t of tasks) shares[`share_${t.name}`] = t.served / totalServed;

        yield {
            stepNumber: tick + 1,
            entities: makeBars(tasks, running.name),
            edges: [],
            description: `Tick ${tick + 1}: ran ${running.name} (nice ${running.nice}, weight ${running.weight.toFixed(0)}); its virtual runtime is now ${running.vruntime.toFixed(2)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                ticks: tick + 1,
                running: running.name,
                vruntimes: tasks.map((t) => t.vruntime),
                ...shares,
            },
        };
    }

    yield {
        stepNumber: ticks + 1,
        entities: makeBars(tasks, ""),
        edges: [],
        description: `After ${ticks} ticks the virtual runtimes are ${tasks.map((t) => t.vruntime.toFixed(1)).join(", ")}; shares track task weights.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            ticks,
            running: "",
            vruntimes: tasks.map((t) => t.vruntime),
            weights: tasks.map((t) => t.weight),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than handing out fixed time slices, CFS tracks how much weighted CPU time each task has already received. The task that has received the least runs next. Giving a high-priority task a larger weight makes its virtual clock tick more slowly, so it can run longer before appearing due again. The scheduler therefore self-corrects and keeps service proportional to priority.",
        invariants: [
            "The runnable task with the smallest virtual runtime is always chosen next.",
            "Virtual runtime increases by the quantum times 1024 divided by the task weight.",
            "A task's real CPU share converges to its weight over the total weight.",
        ],
        correctness:
            "The virtual runtime of a task is its received CPU time divided by its weight. Always serving the minimum virtual runtime is the greedy balance rule for weighted fair queuing: after a task runs, its virtual runtime rises until another task becomes the minimum, so no task can stay at the front. Over a long horizon the difference in virtual runtime between any two continuously runnable tasks stays bounded, which forces each real CPU share to converge to weight divided by total weight.",
        complexityRationale:
            "Each tick compares the virtual runtimes of all tasks to find the minimum and updates one task, so a tick is O(taskCount) with the linear scan used here, or O(log taskCount) with the kernel's tree. Only the per-task counters are stored, giving O(taskCount) space.",
        uses: [
            "CPU process scheduling in the Linux kernel",
            "Fair bandwidth allocation among competing network flows",
            "Weighted task scheduling in container and virtual machine runtimes",
        ],
        references: [
            "Molnar, Completely Fair Scheduler, Linux kernel documentation",
            "Bleaching, Completely Fair Scheduler design notes, 2007",
        ],
        workedExample:
            "With three tasks of weights 2048, 1024, and 512 and a quantum of four, the high-weight task's clock advances by two per tick, the middle by four, and the low by eight. The scheduler repeatedly picks whichever clock is lowest, so over many ticks they receive about half, a quarter, and an eighth of the CPU.",
    },
    id: "cfs-scheduler",
    name: "Completely Fair Scheduler",
    category: "production-systems",
    complexity: { time: "O(ticks * taskCount)", space: "O(taskCount)" },
    defaultInput: {
        tasks: [
            { name: "alpha", nice: 0 },
            { name: "beta", nice: 5 },
            { name: "gamma", nice: -5 },
        ],
        ticks: 24,
        quantum: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "assign each task a weight from its nice value",
        "set every task's virtual runtime to zero",
        "for each scheduling tick",
        "select the runnable task with the smallest virtual runtime",
        "run it for one quantum and charge weighted virtual time",
        "accumulate its real CPU time",
        "done: report virtual runtimes and CPU shares",
    ],
};

export default module;
