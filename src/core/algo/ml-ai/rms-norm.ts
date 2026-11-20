/**
 * rms-norm.ts - Root Mean Square Layer Normalization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RMSNorm rescales a feature vector by its root mean square, then applies a
 * learned per-feature gain. Unlike layer normalization it does not subtract
 * the mean and does not use a learned shift, which makes it cheaper while
 * retaining the useful scale-invariance property.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) for a d-dimensional vector
 *   Space: O(d) for the normalized and output vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the input, the root-mean-square, the normalized values, and
 *     the final gain-scaled output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RmsNormInput {
    x?: number[];
    gamma?: number[];
    eps?: number;
}

/** Normalize one vector by its root mean square with a learned gain. */
export function rmsNorm(x: number[], gamma: number[], eps: number) {
    const d = x.length;
    if (d === 0) {
        return { meanSquare: 0, rms: 0, normalized: [], output: [] };
    }
    const meanSquare = x.reduce((sum, value) => sum + value * value, 0) / d;
    const rms = Math.sqrt(meanSquare + eps);
    const normalized = rms === 0 ? x.map(() => 0) : x.map((value) => value / rms);
    const output = normalized.map((value, index) => value * (gamma[index] ?? 1));
    return { meanSquare, rms, normalized, output };
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `feat-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RmsNormInput | null) ?? {};
    const x: number[] = Array.isArray(task.x) && task.x.length > 0 ? task.x.slice() : [1, 2, -2, 4];
    const d = x.length;
    const gamma: number[] = Array.isArray(task.gamma) && task.gamma.length === d
        ? task.gamma.slice()
        : new Array<number>(d).fill(1);
    const eps = typeof task.eps === "number" && task.eps >= 0 ? task.eps : 1e-6;
    const { meanSquare, rms, normalized, output } = rmsNorm(x, gamma, eps);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(x, "idle"),
        edges: [],
        description: `Normalizing a ${d}-dimensional vector by root mean square with a learned gain.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x: x.map((v) => Number(v.toFixed(8))), meanSquare: 0, rms: 0, gamma, output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(x, "active"),
        edges: [],
        description: `Mean square ${meanSquare.toFixed(4)} gives RMS ${rms.toFixed(4)} with epsilon ${eps}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: {
            x: x.map((v) => Number(v.toFixed(8))),
            meanSquare: Number(meanSquare.toFixed(8)),
            rms: Number(rms.toFixed(8)),
            gamma,
            output: [],
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(normalized, "comparing"),
        edges: [],
        description: "Divide each component by the RMS to obtain a rescaled vector.",
        codeLineNumber: 2,
        layout: "array",
        meta: {
            x: x.map((v) => Number(v.toFixed(8))),
            meanSquare: Number(meanSquare.toFixed(8)),
            rms: Number(rms.toFixed(8)),
            normalized: normalized.map((v) => Number(v.toFixed(8))),
            gamma,
            output: [],
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(output, "sorted"),
        edges: [],
        description: "Apply the learned gain to each component for the final RMSNorm output.",
        codeLineNumber: 3,
        layout: "array",
        meta: {
            x: x.map((v) => Number(v.toFixed(8))),
            meanSquare: Number(meanSquare.toFixed(8)),
            rms: Number(rms.toFixed(8)),
            normalized: normalized.map((v) => Number(v.toFixed(8))),
            gamma,
            output: output.map((v) => Number(v.toFixed(8))),
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RMSNorm keeps the useful part of layer normalization, which is controlling the scale of a vector, and drops the parts that cost extra work. It divides the vector by its root mean square so the overall magnitude becomes roughly one, then lets a learned gain restore a useful range per feature. Because no mean is subtracted, doubling the whole vector does not change the normalized result.",
        invariants: [
            "The root mean square is the square root of the average squared component plus epsilon.",
            "The normalized vector has root mean square approximately one when epsilon is small.",
            "Scaling the input by a positive constant leaves the normalized vector unchanged.",
        ],
        correctness:
            "For input x the transform is x divided by sqrt(mean(x squared) plus epsilon), times the gain g. Multiplying x by a positive constant c multiplies the mean square by c squared, so the RMS grows by c and cancels exactly in the quotient; this proves scale invariance. The final componentwise product with g is the definition of RMSNorm, so the computed output is correct by direct evaluation.",
        complexityRationale:
            "Summing squares and forming the output each scan the d components a constant number of times, giving O(d) time. Only the normalized and output vectors are stored, so space is O(d).",
        uses: [
            "Normalizing hidden states in large language models",
            "Stabilizing training in transformer blocks such as Llama",
            "A cheaper alternative to layer normalization in sequence models",
        ],
        references: [
            "Zhang and Sennrich, Root Mean Square Layer Normalization, NeurIPS 2019",
            "Touvron et al., Llama: Open and Efficient Foundation Language Models, 2023",
        ],
        workedExample:
            "For x = (1, 2, -2, 4) the mean square is (1 + 4 + 4 + 16)/4 = 6.25, so the RMS is 2.5. Dividing gives (0.4, 0.8, -0.8, 1.6); with unit gain those are the final outputs. Scaling x by 3 gives the same normalized values.",
    },
    id: "rms-norm",
    name: "RMS Norm",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { x: [1, 2, -2, 4], gamma: [1, 1, 1, 1], eps: 1e-6 },
    visualType: "array",
    run,
    pseudocode: [
        "read the input vector and the learned gain",
        "compute the mean of the squared components",
        "take the square root after adding epsilon to get the RMS",
        "divide every component by the RMS",
        "multiply each normalized component by its gain",
        "done: report the RMSNorm output",
    ],
};

export default module;
