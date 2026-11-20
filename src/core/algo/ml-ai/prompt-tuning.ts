/**
 * prompt-tuning.ts - Soft Prompt Tuning of a Frozen Model
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Prompt tuning freezes every weight of a pretrained model and learns only a
 * short sequence of continuous vectors prepended to the input embeddings. The
 * downstream computation is unchanged: the soft prompt shifts the pooled input,
 * and gradient descent adjusts the prompt so a frozen classifier produces the
 * right labels. Unlike prefix tuning, the learned vectors exist only at the
 * input layer rather than at every attention layer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * examples * (p + n) * d * classes)
 *   Space: O(p * d) for the trainable prompt
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Learned prompt entries are grid cells indexed by token position and feature.
 *   - The active cell is the entry being updated in the current step.
 *   - The final frame marks the prompt as settled and reports accuracy.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PromptInput {
    examples?: number[][][];
    labels?: number[];
    weights?: number[][];
    bias?: number[];
    prompt?: number[][];
    steps?: number;
    learningRate?: number;
}

type Matrix = number[][];

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

function softmax(row: number[]): number[] {
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

/** Forward pass through a frozen mean-pool plus linear classifier. */
export function promptForward(
    tokens: number[][],
    prompt: Matrix,
    weights: Matrix,
    bias: number[],
): { pooled: number[]; logits: number[]; probs: number[] } {
    const joined = [...prompt, ...tokens];
    const pooled: number[] = [];
    const width = joined[0]?.length ?? 0;
    for (let j = 0; j < width; j += 1) {
        pooled.push(joined.reduce((sum, row) => sum + (row[j] ?? 0), 0) / joined.length);
    }
    const logits = weights.map((row, c) => dot(row, pooled) + (bias[c] ?? 0));
    return { pooled, logits, probs: softmax(logits) };
}

/** Mean cross-entropy loss over all examples. */
export function promptLoss(
    examples: number[][][],
    labels: number[],
    prompt: Matrix,
    weights: Matrix,
    bias: number[],
): number {
    if (examples.length === 0) {
        return 0;
    }
    let total = 0;
    for (let i = 0; i < examples.length; i += 1) {
        const result = promptForward(examples[i] ?? [], prompt, weights, bias);
        const prob = result.probs[labels[i] ?? 0] ?? 0;
        total += -Math.log(Math.max(prob, 1e-12));
    }
    return total / examples.length;
}

/** Exact gradient of the loss with respect to the trainable prompt. */
export function promptGradient(
    examples: number[][][],
    labels: number[],
    prompt: Matrix,
    weights: Matrix,
    bias: number[],
): Matrix {
    const grad: Matrix = prompt.map((row) => row.map(() => 0));
    if (examples.length === 0) {
        return grad;
    }
    for (let i = 0; i < examples.length; i += 1) {
        const tokens = examples[i] ?? [];
        const divisor = (prompt.length + tokens.length) * examples.length;
        const probs = promptForward(tokens, prompt, weights, bias).probs;
        for (let c = 0; c < probs.length; c += 1) {
            const delta = probs[c] - (labels[i] === c ? 1 : 0);
            const w = weights[c] ?? [];
            for (let r = 0; r < prompt.length; r += 1) {
                for (let j = 0; j < (prompt[r]?.length ?? 0); j += 1) {
                    grad[r][j] += (delta * (w[j] ?? 0)) / divisor;
                }
            }
        }
    }
    return grad;
}

function accuracy(
    examples: number[][][],
    labels: number[],
    prompt: Matrix,
    weights: Matrix,
    bias: number[],
): number {
    if (examples.length === 0) {
        return 0;
    }
    let correct = 0;
    for (let i = 0; i < examples.length; i += 1) {
        const probs = promptForward(examples[i] ?? [], prompt, weights, bias).probs;
        const predicted = probs.indexOf(Math.max(...probs));
        if (predicted === labels[i]) {
            correct += 1;
        }
    }
    return correct / examples.length;
}

function makeCells(prompt: Matrix, states: Map<number, EntityState>): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < prompt.length; r += 1) {
        for (let c = 0; c < (prompt[r]?.length ?? 0); c += 1) {
            const index = r * (prompt[0]?.length ?? 1) + c;
            cells.push({
                id: `prompt-${r}-${c}`,
                type: "cell" as const,
                label: (prompt[r]?.[c] ?? 0).toFixed(2),
                value: prompt[r]?.[c] ?? 0,
                state: states.get(index) ?? "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, index },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PromptInput | null) ?? {};
    const examples: number[][][] = task.examples ?? [
        [
            [0.2, 0.1],
            [0.1, 0.2],
        ],
        [
            [-0.2, -0.1],
            [-0.1, -0.2],
        ],
        [
            [0.15, -0.1],
            [0.1, -0.05],
        ],
        [
            [-0.15, 0.1],
            [-0.1, 0.05],
        ],
    ];
    const labels: number[] = task.labels ?? [0, 1, 0, 1];
    const weights: Matrix = task.weights ?? [
        [1, 0],
        [-1, 0],
    ];
    const bias: number[] = task.bias ?? [0, 0];
    const prompt: Matrix = (task.prompt ?? [[0.6, 0]]).map((row) => [...row]);
    const steps = Math.max(0, typeof task.steps === "number" ? Math.floor(task.steps) : 60);
    const learningRate = typeof task.learningRate === "number" ? task.learningRate : 0.2;

    const width = prompt[0]?.length ?? 1;
    const rows = prompt.length;
    const initialLoss = promptLoss(examples, labels, prompt, weights, bias);
    const lossHistory: number[] = [initialLoss];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(prompt, new Map()),
        edges: [],
        description: `Frozen classifier with ${examples.length} examples; only ${rows} soft prompt vector(s) are trainable.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows,
            cols: width,
            loss: initialLoss,
            accuracy: accuracy(examples, labels, prompt, weights, bias),
            weightsChecksum: weights.flat().reduce((a, b) => a + b, 0),
            prompt: prompt.map((r) => [...r]),
            lossHistory: [...lossHistory],
        },
    };
    step += 1;

    for (let iter = 0; iter < steps; iter += 1) {
        const grad = promptGradient(examples, labels, prompt, weights, bias);
        for (let r = 0; r < prompt.length; r += 1) {
            for (let c = 0; c < (prompt[r]?.length ?? 0); c += 1) {
                prompt[r][c] = (prompt[r]?.[c] ?? 0) - learningRate * (grad[r]?.[c] ?? 0);
            }
        }
        const loss = promptLoss(examples, labels, prompt, weights, bias);
        lossHistory.push(loss);
        const active = new Map<number, EntityState>([[iter % (rows * width), "active"]]);
        yield {
            stepNumber: step,
            entities: makeCells(prompt, active),
            edges: [],
            description: `Step ${iter + 1}: gradient step on the soft prompt, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 1 + (iter % 6),
            layout: "grid",
            meta: {
                rows,
                cols: width,
                loss,
                accuracy: accuracy(examples, labels, prompt, weights, bias),
                weightsChecksum: weights.flat().reduce((a, b) => a + b, 0),
                prompt: prompt.map((r) => [...r]),
                lossHistory: [...lossHistory],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(prompt, new Map(Array.from({ length: rows * width }, (_, i) => [i, "sorted"] as [number, EntityState]))),
        edges: [],
        description: `Done: loss ${lossHistory[lossHistory.length - 1]?.toFixed(4)} with ${(accuracy(examples, labels, prompt, weights, bias) * 100).toFixed(0)} percent accuracy; base weights untouched.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows,
            cols: width,
            loss: lossHistory[lossHistory.length - 1] ?? 0,
            accuracy: accuracy(examples, labels, prompt, weights, bias),
            weightsChecksum: weights.flat().reduce((a, b) => a + b, 0),
            prompt: prompt.map((r) => [...r]),
            lossHistory: [...lossHistory],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of changing a large pretrained model, learn a few continuous vectors that are prepended to the input. The model and classifier stay frozen; only those soft prompt vectors move. Gradient descent on the task loss tells the prompt how to nudge the pooled representation so the frozen classifier gives the right answer.",
        invariants: [
            "All base classifier weights and biases remain unchanged throughout training.",
            "The prompt is the only tensor receiving gradient updates.",
            "The forward pass is mean pooling of the soft prompt followed by the real input tokens.",
        ],
        correctness:
            "The pooled representation is an affine function of the prompt with coefficient one over the number of joined vectors, so differentiating the cross-entropy loss gives the reported gradient. Gradient descent along that exact gradient reduces the loss on a smooth objective, and because no other parameter is updated, the frozen model is provably untouched.",
        complexityRationale:
            "Each step evaluates every example once and forms its gradient, costing O(examples * (p + n) * d * classes) time. Only the p by d prompt matrix is stored for training, so the parameter space is O(p * d).",
        uses: [
            "Parameter-efficient adaptation of large language models",
            "Keeping one shared backbone for many downstream tasks",
            "Low-storage fine-tuning when checkpoints must stay small",
        ],
        references: [
            "Lester, Al-Rfou and Constant, The Power of Scale for Parameter-Efficient Prompt Tuning, 2021",
            "Li and Liang, Prefix-Tuning: Optimizing Continuous Prompts for Generation, 2021",
        ],
        workedExample:
            "With a frozen classifier that labels positive pooled first features as class zero, a soft prompt of 0.6 initially pushes a negative example to the wrong side. One gradient step lowers that first prompt coordinate; after several steps both negative examples are classified correctly and the cross-entropy falls.",
    },
    id: "prompt-tuning",
    name: "Soft Prompt Tuning",
    category: "ml-ai",
    complexity: { time: "O(steps * examples * (p + n) * d * classes)", space: "O(p * d)" },
    defaultInput: {
        examples: [
            [
                [0.2, 0.1],
                [0.1, 0.2],
            ],
            [
                [-0.2, -0.1],
                [-0.1, -0.2],
            ],
            [
                [0.15, -0.1],
                [0.1, -0.05],
            ],
            [
                [-0.15, 0.1],
                [-0.1, 0.05],
            ],
        ],
        labels: [0, 1, 0, 1],
        weights: [
            [1, 0],
            [-1, 0],
        ],
        bias: [0, 0],
        prompt: [[0.6, 0]],
        steps: 60,
        learningRate: 0.2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "freeze the classifier weights and bias",
        "initialize a short trainable soft prompt",
        "prepend the prompt to each input and pool the results",
        "compute the frozen classifier probabilities",
        "differentiate the cross-entropy loss with respect to the prompt",
        "move the prompt against its gradient",
        "repeat for the requested number of steps",
        "done: report the final loss, accuracy, and unchanged weights",
    ],
};

export default module;
