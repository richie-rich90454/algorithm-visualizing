/**
 * stochastic-weight-averaging.ts - Stochastic Weight Averaging
 *
 * Stochastic weight averaging collects snapshots of the parameters late in
 * training and returns their arithmetic mean. Combined with a cyclic learning
 * rate, the snapshots orbit the optimum and their average lands closer to the
 * center of the flat region than the final iterate. The demo uses a noisy
 * quadratic with a deterministic cosine learning-rate cycle.
 *
 * Time:  O(steps * d) for d parameters
 * Space: O(d) for the running average
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SwaInput {
    target?: number[];
    steps?: number;
    cycle?: number;
    lrHigh?: number;
    lrLow?: number;
    noise?: number;
}

function makeBars(theta: number[], avg: number[], target: number[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < theta.length; i += 1) {
        entities.push({
            id: `current-${i}`,
            type: "bar" as const,
            label: `current ${(theta[i] ?? 0).toFixed(3)}`,
            value: theta[i] ?? 0,
            state: "active",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "current" },
        });
        entities.push({
            id: `avg-${i}`,
            type: "bar" as const,
            label: `swa ${(avg[i] ?? 0).toFixed(3)}`,
            value: avg[i] ?? 0,
            state: "sorted" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "average" },
        });
        entities.push({
            id: `target-${i}`,
            type: "bar" as const,
            label: `target ${(target[i] ?? 0).toFixed(2)}`,
            value: target[i] ?? 0,
            state: "highlight",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "target" },
        });
    }
    return entities;
}

function objective(theta: number[], target: number[]): number {
    let total = 0;
    for (let i = 0; i < theta.length; i += 1) {
        const diff = (theta[i] ?? 0) - (target[i] ?? 0);
        total += 0.5 * diff * diff;
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SwaInput | null) ?? {};
    const target = task.target?.length ? task.target.slice() : [1, -2, 0.5, 3];
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 24;
    const cycle = typeof task.cycle === "number" ? Math.max(1, Math.floor(task.cycle)) : 6;
    const lrHigh = typeof task.lrHigh === "number" && task.lrHigh > 0 ? task.lrHigh : 0.3;
    const lrLow = typeof task.lrLow === "number" && task.lrLow >= 0 ? task.lrLow : 0.02;
    const noise = typeof task.noise === "number" && task.noise >= 0 ? task.noise : 0.4;
    const dim = target.length;
    const theta = target.map(() => 0);
    const avg = target.map(() => 0);
    let snapshots = 0;
    let lr = lrLow;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, avg, target),
        edges: [],
        description: `Initialize weights at zero with a cosine cycle of length ${cycle} and learning rate from ${lrLow} to ${lrHigh}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, lr, snapshots, objectiveCurrent: objective(theta, target), objectiveAvg: objective(avg, target), current: theta.slice(), average: avg.slice(), target: target.slice() },
    };
    step += 1;

    for (let t = 1; t <= steps; t += 1) {
        const phase = ((t - 1) % cycle) / cycle;
        lr = lrLow + 0.5 * (lrHigh - lrLow) * (1 + Math.cos(Math.PI * phase));
        for (let i = 0; i < dim; i += 1) {
            const grad = (theta[i] ?? 0) - (target[i] ?? 0);
            const jitter = noise * Math.sin((t + 1) * (i + 1) * 0.7);
            theta[i] = (theta[i] ?? 0) - lr * (grad + jitter);
        }
        if (t % cycle === 0) {
            snapshots += 1;
            for (let i = 0; i < dim; i += 1) {
                avg[i] = (avg[i] ?? 0) + ((theta[i] ?? 0) - (avg[i] ?? 0)) / snapshots;
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, avg, target),
            edges: [],
            description: `Step ${t}: learning rate ${lr.toFixed(3)}, snapshots ${snapshots}, current error ${objective(theta, target).toFixed(4)}, averaged error ${objective(avg, target).toFixed(4)}.`,
            codeLineNumber: t === steps ? 6 : 3,
            layout: "array",
            meta: {
                step: t,
                lr,
                snapshots,
                objectiveCurrent: objective(theta, target),
                objectiveAvg: objective(avg, target),
                current: theta.slice(),
                average: avg.slice(),
                target: target.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, avg, target),
        edges: [],
        description: `Done: averaged ${snapshots} snapshots; averaged error ${objective(avg, target).toFixed(4)} versus current error ${objective(theta, target).toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, lr, snapshots, objectiveCurrent: objective(theta, target), objectiveAvg: objective(avg, target), current: theta.slice(), average: avg.slice(), target: target.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Late in training, a cyclic learning rate makes the iterate bounce around the bottom of the loss basin instead of settling at one point. Averaging several of those bouncing positions cancels the jitter and lands near the middle of the flat region. The averaged weights are often flatter and generalize better than the last iterate.",
        invariants: [
            "The learning rate follows a cosine wave within each cycle.",
            "A snapshot is taken exactly at the end of every cycle.",
            "The running mean is the arithmetic average of all snapshots collected so far.",
        ],
        correctness:
            "The running mean uses the incremental formula that keeps the exact arithmetic average after k snapshots. On a noisy quadratic, the snapshots are unbiased draws around the optimum, so their mean has smaller expected squared error than any single snapshot. The test recomputes the whole trajectory, verifies that the reported average equals the mean of the collected snapshots, and checks the frame contract.",
        complexityRationale:
            "Each of the steps performs a gradient update and occasionally folds one snapshot into the running mean, both O(d), so total time is O(steps times d). One extra length-d vector holds the average, giving O(d) space.",
        uses: [
            "Averaging weights from the high phase of a cyclic schedule",
            "Improving generalization without changing the training loop",
            "Cheap ensembling of points along one optimization trajectory",
        ],
        references: [
            "Izmailov et al., Averaging Weights Leads to Wider Optima, UAI, 2018",
            "Polyak and Juditsky, Acceleration of Stochastic Approximation by Averaging, 1992",
        ],
        workedExample:
            "With a cycle of six steps and target (1, minus 2), the learning rate rises and falls while a deterministic jitter nudges each coordinate. At steps six, twelve, eighteen and twenty-four a snapshot is folded into the running mean. The final average sits closer to the target than the oscillating last iterate.",
    },
    id: "stochastic-weight-averaging",
    name: "Stochastic Weight Averaging",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: { target: [1, -2, 0.5, 3], steps: 24, cycle: 6, lrHigh: 0.3, lrLow: 0.02, noise: 0.4 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize weights and an empty running average",
        "repeat for each training step",
        "compute the learning rate from the cosine cycle",
        "update weights with gradient plus deterministic noise",
        "at the end of a cycle fold the weights into the average",
        "record current and averaged errors",
        "done: report the averaged weights and error",
    ],
};

export default module;
