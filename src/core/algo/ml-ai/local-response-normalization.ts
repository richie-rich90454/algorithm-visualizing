/**
 * local-response-normalization.ts - Local Response Normalization
 *
 * Local response normalization divides each activation by a function of the
 * squared activations in a small neighborhood. It implements lateral
 * inhibition: a strongly active unit suppresses its neighbors, which was an
 * early way to encourage competition among feature detectors.
 *
 * Time is O(n * window); space is O(n) for the output values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Apply local response normalization to a one-dimensional activation vector. */
export function localResponseNormalize(
    values: number[],
    k = 1,
    alpha = 1,
    beta = 0.75,
    halfWindow = 1,
): number[] {
    const width = 2 * Math.max(0, halfWindow) + 1;
    return values.map((value, i) => {
        let sum = 0;
        for (let j = i - halfWindow; j <= i + halfWindow; j += 1) {
            if (j >= 0 && j < values.length) {
                sum += (values[j] ?? 0) ** 2;
            }
        }
        const denominator = Math.pow(k + (alpha / width) * sum, beta);
        return value / denominator;
    });
}

/** Local squared sums used by the visualization. */
export function localSquareSums(values: number[], halfWindow = 1): number[] {
    return values.map((_value, i) => {
        let sum = 0;
        for (let j = i - halfWindow; j <= i + halfWindow; j += 1) {
            if (j >= 0 && j < values.length) {
                sum += (values[j] ?? 0) ** 2;
            }
        }
        return sum;
    });
}

function makeCells(
    values: number[],
    sums: number[],
    outputs: number[],
    revealed: number,
): VisualEntity[] {
    const columns = ["input", "square sum", "output"];
    const entities: VisualEntity[] = [];
    for (let i = 0; i < values.length; i += 1) {
        const row = [values[i] ?? 0, sums[i] ?? 0, outputs[i] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            const shown = i <= revealed;
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell",
                label: shown ? `${columns[col]} ${(row[col] ?? 0).toFixed(4)}` : "?",
                value: shown ? (row[col] ?? 0) : 0,
                state: (i === revealed ? "comparing" : shown ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            values?: number[];
            k?: number;
            alpha?: number;
            beta?: number;
            halfWindow?: number;
        } | null
    ) ?? {};
    const values: number[] = task.values ?? [0.5, 2, 1.5, 0.8, 3, 1.2];
    const k = typeof task.k === "number" ? task.k : 1;
    const alpha = typeof task.alpha === "number" ? task.alpha : 1;
    const beta = typeof task.beta === "number" ? task.beta : 0.75;
    const halfWindow = typeof task.halfWindow === "number" ? Math.max(0, Math.floor(task.halfWindow)) : 1;
    const outputs = localResponseNormalize(values, k, alpha, beta, halfWindow);
    const sums = localSquareSums(values, halfWindow);
    const metaBase = { rows: values.length, cols: 3, k, alpha, beta, halfWindow };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(values, sums, outputs, -1),
        edges: [],
        description: `Local response normalization on ${values.length} activations with window radius ${halfWindow}, k ${k}, alpha ${alpha}, beta ${beta}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, outputs },
    };
    step += 1;

    for (let i = 0; i < values.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(values, sums, outputs, i),
            edges: [],
            description: `Position ${i}: squared window sum ${(sums[i] ?? 0).toFixed(3)} divides activation ${(values[i] ?? 0).toFixed(3)} down to ${(outputs[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: i % 2 === 0 ? 1 : 2,
            layout: "grid",
            meta: { ...metaBase, current: i, outputs },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(values, sums, outputs, values.length - 1),
        edges: [],
        description: `Done: strongly active units suppress their neighbors, producing normalized outputs in [${Math.min(...outputs).toFixed(3)}, ${Math.max(...outputs).toFixed(3)}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...metaBase, converged: true, outputs },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Local response normalization models lateral inhibition, the idea that a strongly firing neuron dampens the cells next to it. Each activation is divided by a denominator built from the squared activations in a small neighborhood. Large activations with large neighbors are scaled down the most, so the network's feature detectors compete rather than all firing together.",
        invariants: [
            "The denominator is k plus alpha over the window width times the local squared sum, raised to beta.",
            "The window is clipped at the boundaries, so edge positions average fewer neighbors but still divide by the full width.",
            "Positive inputs stay positive because the denominator is positive whenever k is positive.",
        ],
        correctness:
            "Every output is computed from the definition using an explicit neighborhood sum, and the tests compare against an independent direct implementation for several window sizes. They also check that a zero activation stays zero, that positivity is preserved when k is positive, and that doubling alpha lowers the output of an activation with active neighbors. The square sums in the frames are computed by the same neighborhood loop, so the visualization matches the algorithm.",
        complexityRationale:
            "Each of the n positions scans at most 2 * halfWindow plus one neighbors, so time is O(n * window). The output vector and the displayed square sums use O(n) space.",
        uses: [
            "Competition between feature maps in early convolutional networks",
            "Local contrast normalization in image processing",
            "A historical precursor to batch and instance normalization",
        ],
        references: [
            "Krizhevsky et al., ImageNet Classification with Deep Convolutional Neural Networks, NIPS 2012",
            "Cochrane and Coan, Biologically Inspired Local Normalization, 1994",
        ],
        workedExample:
            "For values (1, 2, 1) with k 1, alpha 1, beta 1 and half-window 1, the middle position has squared sum 1 + 4 + 1 = 6 and divides by 1 + 6/3 = 3, so its output is about 0.67, while the edge positions have smaller sums and are suppressed less.",
    },
    id: "local-response-normalization",
    name: "Local Response Normalization",
    category: "ml-ai",
    complexity: { time: "O(n * window)", space: "O(n)" },
    defaultInput: { values: [0.5, 2, 1.5, 0.8, 3, 1.2], k: 1, alpha: 1, beta: 0.75, halfWindow: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "for each activation position",
        "sum the squares of activations inside the local window",
        "form the denominator from k plus alpha over the window width times that sum",
        "raise the denominator to beta",
        "divide the activation by the denominator",
        "done: report the locally normalized activations",
    ],
};

export default module;
