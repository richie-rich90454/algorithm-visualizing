/**
 * yarn-context-extension.ts - YaRN Context Extension (Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * YaRN extends the context window of a rotary-position-embedding model by
 * rescaling the frequencies used for rotation. It applies the NTK-aware base
 * change, then interpolates each frequency with a ramp that depends on how
 * many rotations the original dimension completed inside the training
 * context. High-frequency dimensions are stretched and low-frequency ones are
 * left alone, which preserves local behavior while extending the range.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(dim) to compute one frequency per even dimension pair
 *   Space: O(dim) for the frequency and ramp arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per frequency pair shows the final YaRN inverse frequency.
 *   - The ramp value and both endpoints are reported in metadata.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface YarnInput {
    dim?: number;
    base?: number;
    scale?: number;
    origMaxPos?: number;
    alpha?: number;
    beta?: number;
}

function bars(values: number[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toExponential(3),
        value,
        state: "comparing" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as YarnInput | null) ?? {};
    let dim = Math.max(4, typeof task.dim === "number" ? Math.trunc(task.dim) : 8);
    if (dim % 2 !== 0) dim += 1;
    const base = typeof task.base === "number" && task.base > 1 ? task.base : 10000;
    const scale = typeof task.scale === "number" && task.scale > 0 ? task.scale : 4;
    const origMaxPos = typeof task.origMaxPos === "number" && task.origMaxPos > 0 ? task.origMaxPos : 2048;
    const alpha = typeof task.alpha === "number" ? task.alpha : 1;
    const beta = typeof task.beta === "number" && task.beta > alpha ? task.beta : alpha + 3;

    const half = dim / 2;
    const basePrime = base * scale ** (dim / (dim - 2));
    const invFreqOrig: number[] = [];
    const invFreqScaled: number[] = [];
    const lambdaArr: number[] = [];
    const rotations: number[] = [];
    const gamma: number[] = [];
    const invFreqYaRN: number[] = [];
    for (let i = 0; i < half; i += 1) {
        const orig = base ** (-2 * i / dim);
        const scaled = basePrime ** (-2 * i / dim);
        const lambdaValue = (2 * Math.PI) / orig;
        const r = origMaxPos / lambdaValue;
        const g = Math.min(1, Math.max(0, (r - alpha) / (beta - alpha)));
        invFreqOrig.push(orig);
        invFreqScaled.push(scaled);
        lambdaArr.push(lambdaValue);
        rotations.push(r);
        gamma.push(g);
        invFreqYaRN.push(((1 - g) * orig + g * scaled) / scale);
    }

    const meta = {
        dim,
        half,
        base,
        scale,
        origMaxPos,
        alpha,
        beta,
        basePrime,
        invFreqOrig,
        invFreqScaled,
        lambda: lambdaArr,
        rotations,
        gamma,
    };
    yield {
        stepNumber: 0,
        entities: bars(invFreqOrig),
        edges: [],
        description: `Original rotary inverse frequencies for ${half} dimension pairs with base ${base}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...meta, phase: "original", invFreqYaRN: [] },
    };
    yield {
        stepNumber: 1,
        entities: bars(invFreqScaled),
        edges: [],
        description: `NTK-aware base becomes ${basePrime.toFixed(1)}, giving rescaled inverse frequencies.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...meta, phase: "ntk", invFreqYaRN: [] },
    };
    yield {
        stepNumber: 2,
        entities: bars(gamma),
        edges: [],
        description: `Interpolation ramp: ${gamma.map((g) => g.toFixed(2)).join(", ")}; high-frequency pairs use the rescaled value.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...meta, phase: "ramp", invFreqYaRN: [] },
    };
    yield {
        stepNumber: 3,
        entities: bars(invFreqYaRN),
        edges: [],
        description: `Final YaRN inverse frequencies divide the ramp-interpolated value by the scale ${scale}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...meta, phase: "yarn", invFreqYaRN },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rotary position embeddings encode position by rotating pairs of dimensions at fixed frequencies. YaRN keeps the low-frequency dimensions that see only a few rotations during training and stretches the high-frequency ones that would alias when the context grows. It first applies an NTK-aware change to the base, then blends old and new frequencies with a ramp, and finally divides by the scale factor.",
        invariants: [
            "The number of frequencies equals half the embedding dimension.",
            "The ramp value for each pair lies between zero and one.",
            "When the scale is one the YaRN frequency equals the original frequency exactly.",
        ],
        correctness:
            "The NTK-aware base is base times scale raised to dim over dim minus two, which preserves the highest frequency while redistributing the rest. For each pair the number of rotations in the training window is the window length over the wavelength, and the ramp clamps a linear rise between the two thresholds. The final inverse frequency is the convex combination of the original and rescaled values divided by the scale; with gamma zero it is the original divided by scale and with gamma one it is the rescaled value divided by scale, so the interpolation endpoints are exact.",
        complexityRationale:
            "The module computes a constant number of arithmetic operations for each of the dim over two frequency pairs, so time and space are both O(dim). No sequence of tokens is stored; only the frequency arrays are kept.",
        uses: [
            "Extending the context window of a trained language model",
            "Long-document retrieval and summarization",
            "Fine-tuning position embeddings for longer sequences",
        ],
        references: [
            "Peng et al., YaRN: Efficient Context Window Extension of Large Language Models, 2023",
            "Su et al., RoFormer: Enhanced Transformer with Rotary Position Embedding, 2021",
        ],
        workedExample:
            "With dimension 8, base 10000, and scale 4, the NTK-aware base is about 20000. A high-frequency pair with many rotations gets gamma one and uses the rescaled frequency divided by four; a low-frequency pair with gamma zero simply uses its original frequency divided by four.",
    },
    id: "yarn-context-extension",
    name: "YaRN Context Extension (Teachable Core)",
    category: "ml-ai",
    complexity: { time: "O(dim)", space: "O(dim)" },
    defaultInput: { dim: 8, base: 10000, scale: 4, origMaxPos: 2048, alpha: 1, beta: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "read dimension, base, scale, and original context length",
        "compute the NTK-aware base from the scale and dimension",
        "for each frequency pair compute the original inverse frequency",
        "compute the wavelength and the number of training rotations",
        "clamp the interpolation ramp between zero and one",
        "blend the original and rescaled inverse frequencies",
        "divide by the scale to get the final frequency",
        "done: report every frequency and ramp value",
    ],
};

export default module;
