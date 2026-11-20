/**
 * dropconnect.ts - DropConnect Weight Masking
 *
 * Instead of dropping activations, DropConnect zeros individual weights with a
 * fixed probability during training. Dividing the surviving weights by the
 * keep probability preserves the expected output, so the technique regularizes
 * a linear or fully connected layer without biasing its mean prediction.
 *
 * Time:  O(rows * cols) per mask, space O(rows * cols)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DropConnectInput {
    weights: number[][];
    inputVector: number[];
    keepProb: number;
    seed: number;
}

/** Generate one uniform value from the shared linear-congruential generator. */
export function nextUniform(state: { value: number }): number {
    state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0;
    return state.value / 4294967296;
}

/** Deterministic Bernoulli mask for a flat set of weights. */
export function dropConnectMask(seed: number, size: number, keepProb: number): number[] {
    const generator = { value: (seed >>> 0) || 1 };
    return Array.from({ length: size }, () => (nextUniform(generator) < keepProb ? 1 : 0));
}

function makeCells(weights: number[][], mask: number[], revealedRows: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < weights.length; r += 1) {
        for (let cIdx = 0; cIdx < (weights[r]?.length ?? 0); cIdx += 1) {
            const index = r * (weights[r]?.length ?? 0) + cIdx;
            const shown = r <= revealedRows;
            const kept = mask[index] === 1;
            const state: EntityState = shown ? (kept ? "sorted" : "error") : "idle";
            entities.push({
                id: `cell-${r}-${cIdx}`,
                type: "cell" as const,
                label: shown ? `w ${(weights[r]![cIdx] ?? 0).toFixed(2)} ${kept ? "kept" : "dropped"}` : "?",
                value: shown ? (weights[r]![cIdx] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: cIdx, kept: shown ? kept : false },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<DropConnectInput> | null) ?? {};
    const weights: number[][] = Array.isArray(task.weights) && task.weights.length > 0
        ? task.weights.map((row) => row.slice())
        : [[0.5, -1, 0.8], [1.2, 0.3, -0.6]];
    const cols = weights[0]?.length ?? 0;
    const inputVector: number[] = Array.isArray(task.inputVector) && task.inputVector.length === cols
        ? task.inputVector.slice()
        : [1, 0.5, -0.5];
    const keepProb = Math.min(1, Math.max(1e-6, task.keepProb ?? 0.7));
    const seed = Math.floor(task.seed ?? 7);
    const rows = weights.length;
    const size = rows * cols;
    const mask = dropConnectMask(seed, size, keepProb);
    const kept = mask.reduce((sum, value) => sum + value, 0);
    const output = weights.map((row, r) =>
        (1 / keepProb) * row.reduce((sum, w, cIdx) => sum + w * (mask[r * cols + cIdx] ?? 0) * (inputVector[cIdx] ?? 0), 0),
    );
    const expectedOutput = weights.map((row) => row.reduce((sum, w, cIdx) => sum + w * (inputVector[cIdx] ?? 0), 0));
    const base = { rows, cols, keepProb, seed, size, kept };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, mask, -1),
        edges: [],
        description: `DropConnect on a ${rows} by ${cols} weight matrix with keep probability ${keepProb}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, rows, cols, mask, output, expectedOutput },
    };
    step += 1;

    for (let r = 0; r < rows; r += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(weights, mask, r),
            edges: [],
            description: `Row ${r}: ${mask.slice(r * cols, (r + 1) * cols).filter((v) => v === 1).length} of ${cols} weights survived the mask.`,
            codeLineNumber: r === rows - 1 ? 4 : 3,
            layout: "grid",
            meta: { ...base, rows, cols, mask, output, expectedOutput, revealed: r },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(weights, mask, rows - 1),
        edges: [],
        description: `Done: ${kept} of ${size} weights kept; scaled outputs preserve the expected prediction.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...base, rows, cols, mask, output, expectedOutput, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Dropout removes neurons, while DropConnect removes the connections between them. For each training pass it flips a coin on every weight and zeros the ones that lose. Scaling the survivors by the inverse keep probability means the average output is unchanged, but individual passes explore different subnetworks, which discourages fragile reliance on any single weight.",
        invariants: [
            "A weight is either kept at its original value scaled by one over the keep probability, or zeroed.",
            "The expected output over random masks equals the unmasked linear output.",
            "The same deterministic seed always produces the same mask.",
        ],
        correctness:
            "For each weight the mask variable is one with probability p and zero otherwise, so its expectation is p and scaling by one over p gives an expected contribution equal to the original weight times its input. Linearity of expectation makes the whole layer unbiased. The replay uses a seeded linear-congruential generator so the mask is reproducible, and the test rebuilds that generator independently, recomputes every output from the mask, and averages many seeds to confirm the unbiased property.",
        complexityRationale:
            "Drawing a mask and applying it to a rows by columns matrix touches each weight a constant number of times, so the work is O(rows * cols). Storing the mask and the output vector uses O(rows * cols) space.",
        uses: [
            "Regularizing fully connected layers in deep neural networks",
            "Reducing co-adaptation between learned weights",
            "A connection-level alternative to activation dropout",
        ],
        references: [
            "Wan et al., Regularization of Neural Networks using DropConnect, ICML, 2013",
            "Srivastava et al., Dropout: A Simple Way to Prevent Neural Networks from Overfitting, JMLR, 2014",
        ],
        workedExample:
            "With weights 0.5, minus one, and 0.8 in the first row, input one, 0.5, minus 0.5, keep probability 0.7, and seed seven, the mask might keep the first and third weight and drop the second. The output becomes one over 0.7 times 0.5 times one plus 0.8 times minus 0.5, while the unmasked expectation is 0.5 minus 0.5 minus 0.4. Averaging over many seeds approaches that expectation.",
    },
    id: "dropconnect",
    name: "DropConnect",
    category: "ml-ai",
    complexity: { time: "O(rows * cols)", space: "O(rows * cols)" },
    defaultInput: {
        weights: [[0.5, -1, 0.8], [1.2, 0.3, -0.6]],
        inputVector: [1, 0.5, -0.5],
        keepProb: 0.7,
        seed: 7,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the weight matrix, input vector, keep probability, and seed",
        "for each weight draw a seeded uniform value",
        "keep the weight when the draw is below the keep probability, else drop it",
        "scale every surviving weight by one over the keep probability",
        "multiply the masked matrix by the input vector to get the output",
        "repeat with other seeds so the average matches the unmasked output",
        "done: report the mask, kept count, and resulting outputs",
    ],
};

export default module;
