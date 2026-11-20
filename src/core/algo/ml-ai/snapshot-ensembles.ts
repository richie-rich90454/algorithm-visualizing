/**
 * snapshot-ensembles.ts - Snapshot Ensembles
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Snapshot ensembles train one network with a cyclical cosine learning rate
 * and save a copy of the weights at the end of each cycle. The learning-rate
 * dip lets the model settle into a different local minimum each cycle, and
 * averaging the predictions of the saved snapshots usually improves accuracy
 * at the cost of a single training run.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(totalSteps) for the schedule, O(snapshots * outputs) to average
 *   Space: O(totalSteps) for the displayed learning-rate schedule
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the learning rate at each training step.
 *   - Snapshot steps are highlighted, then the averaged predictions appear.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SnapshotInput {
    totalSteps?: number;
    cycles?: number;
    predictions?: number[][];
    etaMin?: number;
    etaMax?: number;
}

/** Cyclical cosine learning rate over one cycle of the given length. */
export function cosineCycleLR(step: number, cycleLength: number, etaMin: number, etaMax: number): number {
    const length = Math.max(1, cycleLength);
    const remainder = ((step % length) + length) % length;
    // Treat a positive multiple of the cycle length as the exact end of a
    // cycle so the minimum coincides with the snapshot step.
    const position = step > 0 && remainder === 0 ? length : remainder;
    return etaMin + 0.5 * (etaMax - etaMin) * (1 + Math.cos((Math.PI * position) / length));
}

/** Steps at which a cycle ends and a snapshot is saved. */
export function snapshotPlan(totalSteps: number, cycles: number): number[] {
    const n = Math.max(0, Math.floor(totalSteps));
    const c = Math.max(1, Math.floor(cycles));
    const length = n / c;
    const snapshots: number[] = [];
    for (let k = 1; k <= c; k += 1) snapshots.push(Math.min(n, Math.round(k * length)));
    return snapshots;
}

/** Elementwise arithmetic mean of the snapshot predictions. */
export function ensembleAverage(predictions: number[][]): number[] {
    if (predictions.length === 0) return [];
    const width = predictions[0]?.length ?? 0;
    return Array.from({ length: width }, (_, j) => {
        const sum = predictions.reduce((s, p) => s + (p[j] ?? 0), 0);
        return sum / predictions.length;
    });
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SnapshotInput | null) ?? {};
    const totalSteps = task.totalSteps ?? 24;
    const cycles = task.cycles ?? 3;
    const predictions: number[][] = task.predictions ?? [
        [0.7, 0.2, 0.1],
        [0.5, 0.4, 0.1],
        [0.4, 0.5, 0.1],
    ];
    const etaMin = typeof task.etaMin === "number" ? task.etaMin : 0.01;
    const etaMax = typeof task.etaMax === "number" ? task.etaMax : 0.1;
    const snapshots = snapshotPlan(totalSteps, cycles);
    const cycleLength = totalSteps / Math.max(1, cycles);
    const schedule = Array.from({ length: totalSteps }, (_, t) => cosineCycleLR(t, cycleLength, etaMin, etaMax));
    const snapshotSet = new Set(snapshots);
    const averaged = ensembleAverage(predictions);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(schedule, schedule.map(() => "idle")),
        edges: [],
        description: `Cosine learning rate over ${totalSteps} steps with ${cycles} cycles.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "schedule", totalSteps, cycles, snapshots, averaged: [], etaMin, etaMax },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(
            schedule,
            schedule.map((_, t) => (snapshotSet.has(t) ? "active" : "comparing")),
        ),
        edges: [],
        description: `Save a model snapshot whenever the learning rate hits its minimum.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "snapshots", totalSteps, cycles, snapshots, averaged: [], etaMin, etaMax },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(averaged, averaged.map(() => "sorted")),
        edges: [],
        description: `Average the predictions of all ${predictions.length} saved snapshots.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "average", totalSteps, cycles, snapshots, averaged, etaMin, etaMax },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(averaged, averaged.map(() => "active")),
        edges: [],
        description: `Done: ${snapshots.length} snapshots form the final ensemble prediction.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", totalSteps, cycles, snapshots, averaged, etaMin, etaMax, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of training several independent models, snapshot ensembles repeatedly lower and raise the learning rate so a single model visits several good solutions. At each low point a snapshot of the weights is saved. Averaging their predictions acts like a committee while paying only one training run.",
        invariants: [
            "The cosine learning rate equals its maximum at the start of a cycle and its minimum at the end.",
            "Snapshots occur at cycle boundaries where the rate reaches its minimum.",
            "The ensemble prediction is the arithmetic mean of the snapshot predictions.",
        ],
        correctness:
            "The cyclical cosine schedule starts at eta-max when the cycle position is zero and returns to eta-min when the position approaches the cycle length, so each cycle traverses a full descent and rebound. Taking snapshots at integer multiples of the cycle length captures the settled model at each low point. Averaging the per-snapshot prediction vectors componentwise is the uniform ensemble mean, which reduces variance when the snapshots make complementary errors.",
        complexityRationale:
            "Computing the schedule for total-steps iterations is O(totalSteps), and averaging snapshots across outputs is O(snapshots times outputs). The displayed schedule uses O(totalSteps) space.",
        uses: [
            "Ensemble accuracy from a single training run",
            "Budget-constrained deep learning competitions",
            "Escaping shallow local minima with cyclical schedules",
        ],
        references: [
            "Huang et al., Snapshot Ensembles: Train 1, Get M for Free, ICLR 2017",
            "Loshchilov and Hutter, SGDR: Stochastic Gradient Descent with Warm Restarts, ICLR 2017",
        ],
        workedExample:
            "With 24 steps and 3 cycles, the cycle length is 8 and snapshots are taken at steps 8, 16 and 24 where the cosine rate dips to eta-min. Averaging three prediction vectors such as (0.7,0.2,0.1), (0.5,0.4,0.1) and (0.4,0.5,0.1) gives (0.53,0.37,0.1).",
    },
    id: "snapshot-ensembles",
    name: "Snapshot Ensembles",
    category: "ml-ai",
    complexity: { time: "O(totalSteps + s * o)", space: "O(totalSteps)" },
    defaultInput: {
        totalSteps: 24,
        cycles: 3,
        predictions: [[0.7, 0.2, 0.1], [0.5, 0.4, 0.1], [0.4, 0.5, 0.1]],
        etaMin: 0.01,
        etaMax: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the total steps, cycle count and snapshot predictions",
        "set each cycle length to total steps divided by cycles",
        "compute the cosine learning rate at every step",
        "record a snapshot whenever the rate reaches its minimum",
        "average the predictions of all saved snapshots",
        "done: report the snapshot steps and ensemble prediction",
    ],
};

export default module;
