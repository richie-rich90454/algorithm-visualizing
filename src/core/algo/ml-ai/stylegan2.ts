/**
 * stylegan2.ts - StyleGAN2 Weight Demodulation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * StyleGAN2 applies a per-feature style scale to a convolution weight and then
 * demodulates it: each scaled weight vector is divided by the square root of
 * the sum of its squared entries plus a small constant. The original StyleGAN
 * normalized the activation instead, which leaked style information across
 * features. Moving the normalization onto the weights makes each output
 * feature have unit norm, so styles affect relative patterns without changing
 * the overall signal magnitude.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(o * k) for o output features with k kernel taps each
 *   Space: O(o * k) for the modulated and demodulated weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the demodulated weight matrix, one row per output feature.
 *   - The feature currently being demodulated is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    weights?: number[][];
    styles?: number[];
    eps?: number;
}

function makeCells(matrix: number[][], current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        const row = matrix[r] ?? [];
        for (let c = 0; c < row.length; c += 1) {
            const value = row[c] ?? 0;
            const state: EntityState = r < current ? "sorted" : r === current ? "active" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state,
                x: c,
                y: r,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const weights = (task.weights ?? [
        [1, 2, 1],
        [2, 0, 1],
        [0, 3, 1],
    ]).map((row) => row.slice());
    const styles = (task.styles ?? [1.5, 0.8, 1.2]).slice();
    const eps = typeof task.eps === "number" ? task.eps : 1e-8;
    const outputs = weights.length;
    const demodulated: number[][] = [];
    const rowNorms: number[] = [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, -1),
        edges: [],
        description: `Modulate and demodulate ${outputs} output features with per-feature styles.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: outputs, cols: (weights[0]?.length ?? 0), styles, outputs },
    };
    step += 1;

    for (let i = 0; i < outputs; i += 1) {
        const row = weights[i] ?? [];
        const style = styles[i] ?? 1;
        const modulated = row.map((value) => value * style);
        const power = modulated.reduce((sum, value) => sum + value * value, 0);
        const denom = Math.sqrt(power + eps);
        const demodRow = modulated.map((value) => value / denom);
        demodulated.push(demodRow);
        const rowNorm = Math.sqrt(demodRow.reduce((sum, value) => sum + value * value, 0));
        rowNorms.push(Number(rowNorm.toFixed(6)));
        yield {
            stepNumber: step,
            entities: makeCells(demodulated, i),
            edges: [],
            description: `Feature ${i}: scale weights by style ${style.toFixed(2)}, divide by ${denom.toFixed(4)} for unit norm.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: outputs, cols: row.length, feature: i, style, power: Number(power.toFixed(6)), denominator: Number(denom.toFixed(6)), rowNorm: Number(rowNorm.toFixed(6)) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(demodulated, outputs),
        edges: [],
        description: `Done: every demodulated feature has unit norm, so styles cannot change signal magnitude.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: outputs, cols: (weights[0]?.length ?? 0), demodulated: demodulated.flat().map((v) => Number(v.toFixed(6))), rowNorms, styles },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A style vector should change the pattern a convolution feature produces, not how loud that feature is. StyleGAN2 first multiplies each output feature's weights by its style scale, then divides by that feature's weight norm. The result has unit norm regardless of the style, so a larger style changes the shape of the response but not its overall energy. This replaced activation normalization and removed characteristic artifacts in generated images.",
        invariants: [
            "Each output feature is scaled by exactly one style coefficient.",
            "The demodulation denominator is the square root of scaled squared weights plus epsilon.",
            "Every demodulated feature row has Euclidean norm approximately one.",
        ],
        correctness:
            "For output feature i with weight vector w_i and style s_i, the modulated vector is s_i w_i with squared norm s_i^2 ||w_i||^2. Dividing by sqrt(s_i^2 ||w_i||^2 + eps) yields a vector whose squared norm is s_i^2 ||w_i||^2 / (s_i^2 ||w_i||^2 + eps), which approaches one as eps tends to zero. The style cancels out of the magnitude, so only the relative pattern remains, independent of s_i.",
        complexityRationale:
            "Each of the o features scans its k kernel weights once to modulate and once to accumulate squared power, so the work is O(o * k) time; keeping the modulated and demodulated matrices takes O(o * k) space.",
        uses: [
            "High-fidelity unconditional image generation",
            "Style-mixing and coarse-to-fine image editing",
            "Generative models requiring scale-invariant feature styles",
        ],
        references: [
            "Karras et al., Analyzing and Improving the Image Quality of StyleGAN, CVPR 2020",
            "Karras et al., A Style-Based Generator Architecture for GANs, CVPR 2019",
        ],
        workedExample:
            "For a weight row [1, 2, 1] and style 1.5, modulation gives [1.5, 3, 1.5] with squared power 13.5. The demodulation denominator is about 3.674, giving [0.408, 0.816, 0.408], whose squared entries sum to one. With style 0.8 the numbers differ but the final row still has unit norm, showing the style no longer controls magnitude.",
    },
    id: "stylegan2",
    name: "StyleGAN2 Weight Demodulation",
    category: "ml-ai",
    complexity: { time: "O(o * k)", space: "O(o * k)" },
    defaultInput: {
        weights: [
            [1, 2, 1],
            [2, 0, 1],
            [0, 3, 1],
        ],
        styles: [1.5, 0.8, 1.2],
        eps: 1e-8,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each output feature with style s",
        "multiply every weight in the feature by s",
        "sum the squares of the scaled weights",
        "divide each scaled weight by the square root of that sum",
        "store the demodulated feature weights",
        "done: return weights with unit norm per feature",
    ],
};

export default module;
