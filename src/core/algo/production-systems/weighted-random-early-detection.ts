/**
 * weighted-random-early-detection.ts - Weighted Random Early Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * WRED extends Random Early Detection by giving each traffic class its own
 * drop thresholds. A class with a larger weight gets lower thresholds and is
 * therefore dropped sooner when the average queue grows. The average queue is
 * an exponential moving average, which smooths out short bursts so that a
 * single spike does not trigger a wave of drops.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(packets)
 *   Space: O(packets) for the recorded series
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One grid row per arriving packet, with the instantaneous queue, average
 *     queue, effective thresholds, drop probability, and verdict as columns.
 *   - A dropped packet is red, a probability between zero and one is amber,
 *     and a packet below the minimum threshold is idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface WredParams {
    wq: number;
    minTh: number;
    maxTh: number;
    maxP: number;
    weight: number;
}

export interface WredStep {
    index: number;
    queue: number;
    average: number;
    minEff: number;
    maxEff: number;
    probability: number;
    dropped: boolean;
    region: "below" | "between" | "above";
}

/** Compute one WRED decision and the updated average queue. */
export function wredStep(index: number, queue: number, previousAvg: number, params: WredParams): WredStep {
    const wq = Math.min(1, Math.max(0, params.wq));
    const weight = Math.min(1, Math.max(0.01, params.weight));
    const minTh = Math.max(0, params.minTh);
    const maxTh = Math.max(minTh + 1, params.maxTh);
    const maxP = Math.min(1, Math.max(0, params.maxP));
    const scale = 1.1 - weight;
    const minEff = minTh * scale;
    const maxEff = Math.max(minEff + 1, maxTh * scale);
    const average = (1 - wq) * previousAvg + wq * queue;
    let region: WredStep["region"];
    let probability: number;
    if (average < minEff) {
        region = "below";
        probability = 0;
    } else if (average >= maxEff) {
        region = "above";
        probability = maxP;
    } else {
        region = "between";
        probability = maxP * (average - minEff) / (maxEff - minEff);
    }
    const dropped = probability > 0 && ((index * 2654435761 + Math.round(probability * 100000)) % 100000) / 100000 < probability;
    return { index, queue, average, minEff, maxEff, probability, dropped, region };
}

function makeCells(steps: WredStep[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (const step of steps) {
        const values: Array<[string, number]> = [
            ["q", step.queue],
            ["avg", step.average],
            ["min", step.minEff],
            ["max", step.maxEff],
            ["p", step.probability],
            ["drop", step.dropped ? 1 : 0],
        ];
        values.forEach(([label, value], col) => {
            let state: EntityState = "idle";
            if (col === 5) {
                state = step.dropped ? "error" : "sorted";
            } else if (col === 4 && step.probability > 0) {
                state = "comparing";
            } else if (col === 1 && step.region === "between") {
                state = "active";
            }
            entities.push({
                id: `cell-${step.index}-${col}`,
                type: "cell" as const,
                label: `${label}:${typeof value === "number" ? value.toFixed(2) : value}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: step.index, col, kind: label, region: step.region },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        queues?: number[];
        weights?: number[];
        wq?: number;
        minTh?: number;
        maxTh?: number;
        maxP?: number;
    } | null) ?? {};
    const queues = Array.isArray(task.queues) && task.queues.length > 0
        ? task.queues.map((value) => Math.max(0, Math.floor(Number(value) || 0)))
        : [2, 4, 6, 10, 14, 18, 20, 18, 12, 6];
    const weights = Array.isArray(task.weights) && task.weights.length > 0
        ? task.weights.map((value) => Math.min(1, Math.max(0.01, Number(value) || 0.5)))
        : queues.map(() => 0.5);
    const base: WredParams = {
        wq: Math.min(1, Math.max(0, Number(task.wq ?? 0.002))),
        minTh: Math.max(0, Number(task.minTh ?? 5)),
        maxTh: Math.max(6, Number(task.maxTh ?? 15)),
        maxP: Math.min(1, Math.max(0, Number(task.maxP ?? 0.1))),
        weight: 0.5,
    };

    const steps: WredStep[] = [];
    let average = 0;
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: [],
        edges: [],
        description: `WRED over ${queues.length} packet(s), min threshold ${base.minTh}, max threshold ${base.maxTh}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 0, cols: 6, queues: [], averages: [], probabilities: [], dropped: [], regions: [] },
    };
    stepNumber += 1;

    for (let i = 0; i < queues.length; i += 1) {
        const decision = wredStep(i, queues[i] ?? 0, average, { ...base, weight: weights[i] ?? 0.5 });
        average = decision.average;
        steps.push(decision);
        const dropCount = steps.filter((s) => s.dropped).length;
        yield {
            stepNumber: stepNumber,
            entities: makeCells(steps),
            edges: [],
            description: `Packet ${i}: queue ${decision.queue}, average ${decision.average.toFixed(2)}, drop probability ${decision.probability.toFixed(3)} - ${decision.dropped ? "dropped" : "queued"}.`,
            codeLineNumber: decision.region === "below" ? 1 : decision.region === "between" ? 3 : 4,
            layout: "grid",
            meta: {
                rows: steps.length,
                cols: 6,
                queues: steps.map((s) => s.queue),
                averages: steps.map((s) => s.average),
                probabilities: steps.map((s) => s.probability),
                dropped: steps.map((s) => (s.dropped ? 1 : 0)),
                regions: steps.map((s) => s.region),
                drops: dropCount,
            },
        };
        stepNumber += 1;
    }

    yield {
        stepNumber: stepNumber,
        entities: makeCells(steps),
        edges: [],
        description: `WRED finished with ${steps.filter((s) => s.dropped).length} drop(s) across ${steps.length} packet(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: steps.length,
            cols: 6,
            queues: steps.map((s) => s.queue),
            averages: steps.map((s) => s.average),
            probabilities: steps.map((s) => s.probability),
            dropped: steps.map((s) => (s.dropped ? 1 : 0)),
            regions: steps.map((s) => s.region),
            drops: steps.filter((s) => s.dropped).length,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of waiting for a queue to fill completely, watch its smoothed average and start dropping packets early so senders slow down before latency explodes. Different traffic classes get different thresholds: a class with more weight reaches its drop zone at a smaller queue, so it is throttled sooner and the network stays fair.",
        invariants: [
            "The average queue is an exponential moving average of the instantaneous queue.",
            "Drop probability is zero below the minimum threshold and capped at maxP above the maximum threshold.",
            "A larger class weight produces a lower effective threshold and therefore a higher drop probability.",
        ],
        correctness:
            "The exponential moving average guarantees that a single burst cannot dominate the decision because each sample contributes only wq of its value. Linear interpolation between the two thresholds makes the drop probability continuous and monotone in the average queue, so the drop rate rises gradually rather than jumping, which dampens synchronized sender backoff.",
        complexityRationale:
            "Each arriving packet performs one multiply-add for the average, a few comparisons, and a constant-time drop decision, so total time is linear in the number of packets. The module records one row per packet, giving linear space.",
        uses: [
            "Congestion avoidance on router output interfaces",
            "Differentiated services with per-class drop profiles",
            "Data-center switches protecting incast queues",
        ],
        references: [
            "Floyd and Jacobson, Random Early Detection Gateways for Congestion Avoidance, 1993",
            "RFC 2597, Assured Forwarding PHB Group, 1999",
        ],
        workedExample:
            "With min threshold 5, max threshold 15 and class weight 0.5, the scale is 0.6, giving effective thresholds 3 and 9. A packet arriving at queue 10 pushes the smoothed average toward 10, so the drop probability is capped at maxP; a queue of 2 leaves the probability at zero.",
    },
    id: "weighted-random-early-detection",
    name: "Weighted Random Early Detection",
    category: "production-systems",
    complexity: { time: "O(p)", space: "O(p)" },
    defaultInput: {
        queues: [2, 4, 6, 10, 14, 18, 20, 18, 12, 6],
        weights: [0.3, 0.3, 0.5, 0.5, 0.8, 0.8, 1, 1, 0.5, 0.3],
        wq: 0.002,
        minTh: 5,
        maxTh: 15,
        maxP: 0.1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the average queue to zero",
        "for each arriving packet with queue size q and class weight w",
        "update average to (1-wq) times average plus wq times q",
        "scale the minimum and maximum thresholds by w",
        "if average is below the scaled minimum, keep the packet",
        "if average is at or above the scaled maximum, drop the packet",
        "otherwise drop with linearly interpolated probability",
        "record the decision and continue with the next packet",
        "done: report the drop count and decision series",
    ],
};

export default module;
