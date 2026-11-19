/**
 * stride-scheduling.ts - Stride Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Stride scheduling is a deterministic proportional-share scheduler. Each
 * process has a weight and a stride equal to a large constant divided by that
 * weight. A process's pass counter starts at zero and grows by its stride every
 * time it runs. The scheduler always runs the runnable process with the smallest
 * pass, so a heavier process (smaller stride) accrues pass more slowly and is
 * chosen more often.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * p) for T quanta and p processes (linear scan for minimum pass)
 *   Space: O(p) for process state and the run log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per process shows its remaining burst, weight, and pass.
 *   - The chosen process is CYAN, finished ones GREEN.
 *   - meta carries the strides, pass counters, and the run log.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Proc {
    id: string;
    weight: number;
    burst: number;
}

function normalize(input: unknown): Proc[] {
    const task = (input as { processes?: Array<{ id?: string; weight?: number; burst?: number }> } | null) ?? {};
    const specs = Array.isArray(task.processes) && task.processes.length > 0
        ? task.processes
        : [
              { id: "P1", weight: 4, burst: 6 },
              { id: "P2", weight: 2, burst: 4 },
              { id: "P3", weight: 1, burst: 2 },
          ];
    return specs.map((spec, index) => ({
        id: String(spec.id ?? `P${index + 1}`),
        weight: Math.max(1, Math.floor(Number(spec.weight) || 1)),
        burst: Math.max(0, Math.floor(Number(spec.burst) || 0)),
    }));
}

function makeCells(
    procs: Proc[],
    remaining: number[],
    passes: number[],
    running: number,
): VisualEntity[] {
    return procs.map((proc, index) => {
        const left = remaining[index] ?? 0;
        let state: EntityState = "idle";
        if (left === 0) {
            state = "sorted";
        } else if (index === running) {
            state = "active";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${proc.id} (w${proc.weight}): ${left} pass ${passes[index] ?? 0}`,
            value: left,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: 0,
                col: index,
                id: proc.id,
                weight: proc.weight,
                remaining: left,
                pass: passes[index] ?? 0,
            },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { big?: number } | null) ?? {};
    const procs = normalize(input);
    const big = Math.max(procs.reduce((max, proc) => Math.max(max, proc.weight), 1) * 2, Math.floor(Number(task.big) || 10000));
    const strides = procs.map((proc) => Math.max(1, Math.floor(big / proc.weight)));
    const remaining = procs.map((proc) => proc.burst);
    const passes = procs.map(() => 0);
    const runLog: string[] = [];

    yield {
        stepNumber: 0,
        entities: makeCells(procs, remaining, passes, -1),
        edges: [],
        description: `Stride scheduling with constant ${big}; strides are ${strides.join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: procs.length,
            big,
            strides,
            weights: procs.map((proc) => proc.weight),
            passes,
            runLog,
        },
    };
    let step = 1;

    const maxQuanta = remaining.reduce((sum, value) => sum + value, 0);
    for (let tick = 0; tick < maxQuanta; tick += 1) {
        let choice = -1;
        for (let i = 0; i < procs.length; i += 1) {
            if ((remaining[i] ?? 0) <= 0) {
                continue;
            }
            if (choice < 0 || (passes[i] ?? 0) < (passes[choice] ?? 0)) {
                choice = i;
            }
        }
        if (choice < 0) {
            break;
        }
        remaining[choice] = (remaining[choice] ?? 0) - 1;
        passes[choice] = (passes[choice] ?? 0) + (strides[choice] ?? 1);
        runLog.push(procs[choice]?.id ?? `P${choice}`);
        yield {
            stepNumber: step,
            entities: makeCells(procs, remaining, passes, choice),
            edges: [],
            description: `Quantum ${tick + 1}: ${procs[choice]?.id} had the smallest pass and ran; its pass is now ${passes[choice]}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 1,
                cols: procs.length,
                big,
                strides,
                weights: procs.map((proc) => proc.weight),
                passes: [...passes],
                runLog: [...runLog],
                chosen: choice,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(procs, remaining, passes, -1),
        edges: [],
        description: `Finished after ${runLog.length} quantum(q); final passes ${passes.join(", ")} balance by weight.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 1,
            cols: procs.length,
            big,
            strides,
            weights: procs.map((proc) => proc.weight),
            passes,
            runLog,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give each process a pass counter that starts at zero. Every time a process runs, add its stride, which is a fixed constant divided by its weight. Always serve the process whose pass is smallest. A heavy process has a small stride, so its pass climbs slowly and it keeps returning to the front of the line more often than a light process.",
        invariants: [
            "A process's stride is inversely proportional to its weight and never changes during the run.",
            "After a process runs, its pass increases by exactly its stride.",
            "The scheduler always picks a runnable process with the minimum pass, breaking ties by input order.",
        ],
        correctness:
            "Because pass grows by stride, over a long interval a process runs about T divided by its stride times, which equals T times weight divided by the constant, so CPU share is proportional to weight. The strict less-than scan picks a true minimum pass and input order breaks ties deterministically. The companion test replays an independent simulation of passes and strides and compares the entire run log, and it verifies that doubling a weight roughly doubles the number of quanta won.",
        complexityRationale:
            "Each quantum scans all p processes to find the smallest pass, so T quanta take O(T * p). Storing weights, strides, passes, and the run log uses O(p) space.",
        uses: [
            "Deterministic fair-share CPU schedulers",
            "Weighted bandwidth allocation in network switches",
            "A predictable alternative to lottery scheduling when randomness is undesirable",
        ],
        references: [
            "Waldspurger and Weihl, Stride Scheduling: Deterministic Proportional-Share Resource Management, 1995",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, CPU Scheduling chapter",
        ],
        workedExample:
            "With constant 12 and weights 4, 2, and 1, the strides are 3, 6, and 12. Starting from passes 0, 0, 0 the first three quanta go to P1, P2, and P3 in that order because 3 is less than 6 and 6 is less than 12; after each run its pass grows by its stride.",
    },
    id: "stride-scheduling",
    name: "Stride Scheduling",
    category: "production-systems",
    complexity: { time: "O(T * p)", space: "O(p)" },
    defaultInput: {
        processes: [
            { id: "P1", weight: 4, burst: 6 },
            { id: "P2", weight: 2, burst: 4 },
            { id: "P3", weight: 1, burst: 2 },
        ],
        big: 10000,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a large constant and set each stride to the constant divided by its weight",
        "initialize every process's pass counter to zero",
        "select the runnable process with the smallest pass, breaking ties by input order",
        "run it for one quantum and decrement its remaining burst",
        "increase the chosen process's pass by its stride",
        "remove a process once its burst reaches zero",
        "repeat until no runnable process remains",
        "done: report the strides, final passes, and the run sequence",
    ],
};

export default module;
