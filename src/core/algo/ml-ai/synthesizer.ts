/**
 * synthesizer.ts - Synthesizer Attention
 *
 * The Synthesizer replaces query-key dot products with attention weights that
 * are synthesized directly from the input by a small feed-forward network. In
 * the dense form used here, a row's attention distribution depends only on its
 * own input vector, not on pairwise interactions. The resulting weights still
 * mix value vectors exactly as in ordinary attention.
 *
 * Time O(rows * (d * h + h * rows + rows * out)), space O(rows^2).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface SynthInput {
    x: Matrix;
    w1: Matrix;
    w2: Matrix;
    v: Matrix;
}

export interface SynthResult {
    logits: Matrix;
    weights: Matrix;
    output: Matrix;
}

function matmul(a: Matrix, b: Matrix): Matrix {
    return a.map((row) =>
        (b[0] ?? []).map((_, j) => row.reduce((acc, v, i) => acc + v * (b[i]?.[j] ?? 0), 0)),
    );
}

/** Synthesize attention weights from the input and apply them to values. */
export function synthesize(input: SynthInput): SynthResult {
    const logits = matmul(matmul(input.x, input.w1), input.w2);
    const weights = logits.map((row) => {
        const max = Math.max(...row);
        const exps = row.map((v) => Math.exp(v - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map((e) => e / sum);
    });
    return { logits, weights, output: matmul(weights, input.v) };
}

function makeCells(matrix: Matrix, label: string): VisualEntity[] {
    const entities: VisualEntity[] = [];
    matrix.forEach((row, r) => {
        row.forEach((v, c) => {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: `${label}[${r},${c}]=${v.toFixed(3)}`,
                value: v,
                state: "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<SynthInput> | null) ?? {};
    const x = task.x ?? [[1, 0], [0, 1]];
    const w1 = task.w1 ?? [[1, 0], [0, 1]];
    const w2 = task.w2 ?? [[1, -1], [-1, 1]];
    const v = task.v ?? [[1, 2], [3, 0]];
    const result = synthesize({ x, w1, w2, v });
    const rows = x.length;
    const cols = result.weights[0]?.length ?? 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result.logits, "logit"),
        edges: [],
        description: `Synthesizer on ${rows} rows: produce attention logits from the input alone.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, output: result.output.flat(), outCols: result.output[0]?.length ?? 0 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(result.weights, "weight"),
        edges: [],
        description: "Apply softmax to each row of logits to obtain synthesized attention weights.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows, cols, output: result.output.flat(), outCols: result.output[0]?.length ?? 0 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(result.output, "output"),
        edges: [],
        description: "Multiply the attention weights by the value matrix.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols: result.output[0]?.length ?? 0, output: result.output.flat(), outCols: result.output[0]?.length ?? 0 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(result.output, "output"),
        edges: [],
        description: "Done: attention without pairwise query-key products, yet values are still mixed.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows, cols: result.output[0]?.length ?? 0, output: result.output.flat(), outCols: result.output[0]?.length ?? 0, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ordinary attention derives each weight from a query-key comparison. A Synthesizer asks a simpler question: can a row decide how to distribute its attention using only its own input? A small feed-forward network maps the input to a full row of attention logits, which are softmaxed and applied to the values. This removes the quadratic token-pair computation while keeping a learnable mixing matrix.",
        invariants: [
            "A row's attention logits depend only on that row's input vector.",
            "Each row of weights is a softmax and sums to one.",
            "The output is the product of the weight matrix with the value matrix.",
        ],
        correctness:
            "The code computes logits as x times W1 times W2 with explicit matrix products, softmaxes each row with a numerically stable maximum shift, and multiplies the weight matrix by the values. This matches the dense Synthesizer definition. The test recomputes the two matrix products and softmax directly and compares every output entry, and also checks that all weight rows sum to one.",
        complexityRationale:
            "The two feed-forward products cost O(rows * d * h) and O(rows * h * rows), and applying attention to values costs O(rows^2 * out); memory for the weight matrix is O(rows^2).",
        uses: [
            "Efficient attention alternatives in language models",
            "Sequence mixing without token-pair interactions",
            "Lightweight transformer research baselines",
        ],
        references: [
            "Tay et al., Synthesizer: Rethinking Self-Attention in Transformer Models, ICML 2021",
            "Vaswani et al., Attention Is All You Need, NeurIPS 2017",
        ],
        workedExample:
            "With a single input row [1, 0], W1 as the identity, W2 = [[1, -1], [-1, 1]], the logits are [1, -1]. Softmax gives weights about [0.88, 0.12], so the output is roughly 0.88 times the first value row plus 0.12 times the second, even though no query-key product was ever formed.",
    },
    id: "synthesizer",
    name: "Synthesizer Attention",
    category: "ml-ai",
    complexity: { time: "O(rows * (d * h + h * rows + rows * out))", space: "O(rows^2)" },
    defaultInput: {
        x: [[1, 0], [0, 1]],
        w1: [[1, 0], [0, 1]],
        w2: [[1, -1], [-1, 1]],
        v: [[1, 2], [3, 0]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute hidden features H = x times W1",
        "compute attention logits L = H times W2",
        "apply softmax to each row of L to obtain weights A",
        "compute the attended output as A times the value matrix V",
        "store the logits, weights, and output",
        "done: report the synthesized outputs",
    ],
};

export default module;
