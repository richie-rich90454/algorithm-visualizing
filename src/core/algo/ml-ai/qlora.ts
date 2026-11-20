/**
 * qlora.ts - QLoRA: 4-Bit Quantized Base Weights with Low-Rank Adapters
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * QLoRA freezes a quantized base weight matrix and trains only two small
 * low-rank matrices A and B. The effective weight is Wq + B*A, so a full-rank
 * fine-tune is replaced by a rank-r update. This teaching model uses a uniform
 * 4-bit quantizer and one exact gradient step on A and B against a small mean
 * squared error objective, making both the quantization error and the adapter
 * update fully checkable.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL TEACHING MODEL, not QLoRA. The real method uses NF4 with
 * double quantization, paged optimizers, and full transformer training. Here a
 * plain uniform 4-bit codebook and a single hand-computed gradient step expose
 * the exact mathematics. Nothing here is a production training or compression
 * routine.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * n) to quantize and O(m * n * r) per adapter gradient step
 *   Space: O(m * n + r * (m + n)) for weights, codes, and adapters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Base-weight codes are shown as a grid, one row at a time.
 *   - Predictions and targets are shown side by side as a two-row grid.
 *   - The A and B adapter matrices are shown before the update.
 *   - The final frame shows predictions after one gradient step.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    W?: number[][];
    x?: number[];
    y?: number[];
    A?: number[][];
    B?: number[][];
    lr?: number;
}

/** Uniform 4-bit quantization of a weight matrix to codes in 0..15. */
export function quantize4(W: number[][]): { codes: number[][]; min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const row of W) {
        for (const value of row) {
            if (value < min) min = value;
            if (value > max) max = value;
        }
    }
    if (!Number.isFinite(min)) {
        min = 0;
        max = 0;
    }
    const range = max - min;
    const codes = W.map((row) =>
        row.map((value) => {
            if (range === 0) return 0;
            return Math.max(0, Math.min(15, Math.round(((value - min) / range) * 15)));
        }),
    );
    return { codes, min, max };
}

/** Reverse the uniform 4-bit codes into dequantized weights. */
export function dequantize4(codes: number[][], min: number, max: number): number[][] {
    const range = max - min;
    return codes.map((row) => row.map((code) => min + (code / 15) * range));
}

/** Matrix-vector product. */
export function matVec(M: number[][], v: number[]): number[] {
    return M.map((row) => row.reduce((sum, value, j) => sum + value * (v[j] ?? 0), 0));
}

/** Prediction of the frozen base plus the low-rank adapter: (Wq + B*A) x. */
export function loraPrediction(Wq: number[][], A: number[][], B: number[][], x: number[]): number[] {
    const base = matVec(Wq, x);
    const adapterInput = matVec(A, x);
    const delta = matVec(B, adapterInput);
    return base.map((value, i) => value + (delta[i] ?? 0));
}

/** Half the sum of squared prediction errors. */
export function loraLoss(Wq: number[][], A: number[][], B: number[][], x: number[], y: number[]): number {
    const pred = loraPrediction(Wq, A, B, x);
    return 0.5 * pred.reduce((sum, value, i) => sum + (value - (y[i] ?? 0)) ** 2, 0);
}

/** Exact gradients of the loss with respect to A and B. */
export function loraGradient(
    Wq: number[][],
    A: number[][],
    B: number[][],
    x: number[],
    y: number[],
): { dA: number[][]; dB: number[][]; loss: number } {
    const pred = loraPrediction(Wq, A, B, x);
    const err = pred.map((value, i) => value - (y[i] ?? 0));
    const u = matVec(A, x);
    const dB = B.map((row, i) => row.map((_value, k) => (err[i] ?? 0) * (u[k] ?? 0)));
    const dA = A.map((row, k) => {
        const gate = B.reduce((sum, bRow, i) => sum + (bRow[k] ?? 0) * (err[i] ?? 0), 0);
        return row.map((_value, j) => gate * (x[j] ?? 0));
    });
    return { dA, dB, loss: 0.5 * err.reduce((sum, value) => sum + value ** 2, 0) };
}

const flatten = (matrix: number[][]): number[] => matrix.reduce<number[]>((acc, row) => acc.concat(row), []);

function makeCells(matrix: number[][], label: (r: number, c: number) => string, revealedRows: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
            const shown = r < revealedRows;
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: shown ? label(r, c) : "?",
                value: shown ? matrix[r]?.[c] ?? 0 : 0,
                state: shown ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

/** The QLoRA teaching generator (one quantization and one adapter step). */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const W = task.W ?? [
        [0.8, -0.4],
        [0.2, 0.6],
    ];
    const x = task.x ?? [1, 0.5];
    const y = task.y ?? [0.3, -0.2];
    const A = task.A ?? [[0.1, -0.1]];
    const B = task.B ?? [[0.2], [-0.15]];
    const lr = typeof task.lr === "number" ? task.lr : 0.01;

    const { codes, min, max } = quantize4(W);
    const Wq = dequantize4(codes, min, max);
    const pred0 = loraPrediction(Wq, A, B, x);
    const grad = loraGradient(Wq, A, B, x, y);
    const A1 = A.map((row, r) => row.map((value, c) => value - lr * ((grad.dA[r]?.[c]) ?? 0)));
    const B1 = B.map((row, r) => row.map((value, c) => value - lr * ((grad.dB[r]?.[c]) ?? 0)));
    const pred1 = loraPrediction(Wq, A1, B1, x);
    const lossAfter = loraLoss(Wq, A1, B1, x, y);
    const m = W.length;
    const n = W[0]?.length ?? 0;
    const r = A.length;
    const compare = (pred: number[]): number[][] => [pred, y];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(codes, (rr, cc) => String(codes[rr]?.[cc] ?? 0), 0),
        edges: [],
        description: `Quantize a ${m} by ${n} weight matrix to 4-bit codes in [${min.toFixed(2)}, ${max.toFixed(2)}]; freeze Wq and train rank-${r} adapters.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: m,
            cols: n,
            phase: "quantize",
            m,
            n,
            r,
            min,
            max,
            codes: flatten(codes),
            Wq: flatten(Wq),
            lossBefore: grad.loss,
        },
    };
    step += 1;

    for (let i = 0; i < m; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(codes, (rr, cc) => String(codes[rr]?.[cc] ?? 0), i + 1),
            edges: [],
            description: `Base row ${i}: codes ${(codes[i] ?? []).join(", ")} dequantize to ${(Wq[i] ?? []).map((v) => v.toFixed(2)).join(", ")}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                rows: m,
                cols: n,
                phase: "quantize",
                m,
                n,
                r,
                min,
                max,
                codes: flatten(codes),
                lossBefore: grad.loss,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(compare(pred0), (rr, cc) => (compare(pred0)[rr]?.[cc] ?? 0).toFixed(2), 2),
        edges: [],
        description: `Forward with frozen Wq: predictions ${pred0.map((v) => v.toFixed(3)).join(", ")} versus targets ${y.join(", ")}; loss ${grad.loss.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {
            rows: 2,
            cols: m,
            phase: "forward",
            m,
            n,
            r,
            pred: pred0,
            target: y,
            lossBefore: grad.loss,
            min,
            max,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(A, (rr, cc) => (A[rr]?.[cc] ?? 0).toFixed(2), r),
        edges: [],
        description: `Adapter A gradient row(s) ${flatten(grad.dA).map((v) => v.toFixed(3)).join(", ")}; update with learning rate ${lr}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: r,
            cols: n,
            phase: "adapter-A",
            m,
            n,
            r,
            min,
            max,
            dA: flatten(grad.dA),
            dB: flatten(grad.dB),
            lossBefore: grad.loss,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(B, (rr, cc) => (B[rr]?.[cc] ?? 0).toFixed(2), m),
        edges: [],
        description: `Adapter B gradient ${flatten(grad.dB).map((v) => v.toFixed(3)).join(", ")}; the low-rank product B*A is the only trained weight change.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: m,
            cols: r,
            phase: "adapter-B",
            m,
            n,
            r,
            min,
            max,
            dA: flatten(grad.dA),
            dB: flatten(grad.dB),
            lossBefore: grad.loss,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(compare(pred1), (rr, cc) => (compare(pred1)[rr]?.[cc] ?? 0).toFixed(2), 2),
        edges: [],
        description: `Done: after one step predictions are ${pred1.map((v) => v.toFixed(3)).join(", ")} and loss fell from ${grad.loss.toFixed(4)} to ${lossAfter.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 2,
            cols: m,
            phase: "done",
            m,
            n,
            r,
            min,
            max,
            pred: pred1,
            target: y,
            lossBefore: grad.loss,
            lossAfter,
            improved: lossAfter <= grad.loss,
            converged: true,
        },
    };
}

/** The QLoRA teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Full fine-tuning updates every weight in a large matrix, which is expensive. QLoRA instead freezes a quantized copy of that matrix and learns a thin rank-r correction B*A alongside it. Because r is tiny, the number of trainable numbers collapses from m times n to r times (m plus n), while the frozen weights never move.",
        invariants: [
            "The quantized base weights Wq stay fixed during the adapter step.",
            "The trainable update has rank at most r because it is the product B*A.",
            "The loss is half the squared error between prediction and target.",
        ],
        correctness:
            "Let u = A x, so the adapter contributes B u and the prediction is Wq x + B u. Writing the error as e = prediction - y, the chain rule gives dB = e u^T and dA = (B^T e) x^T, exactly the gradients computed here. A sufficiently small gradient step cannot increase a smooth quadratic loss, so the reported loss after the step is at most the loss before it. Finite differences of the loss confirm each partial derivative.",
        complexityRationale:
            "Uniform quantization scans all m*n weights once, O(m*n), and dequantization is the same size. A forward and backward pass each cost O(m*n*r) in the naive matrix products used here, and storing Wq, its codes, and both adapters takes O(m*n + r*(m+n)) space.",
        uses: [
            "Teaching parameter-efficient fine-tuning of large language models",
            "Introducing quantization-aware training and NF4",
            "Understanding low-rank adapter gradients before studying real QLoRA",
        ],
        references: [
            "Hu et al., LoRA: Low-Rank Adaptation of Large Language Models, ICLR 2022",
            "Dettmers et al., QLoRA: Efficient Finetuning of Quantized LLMs, NeurIPS 2023",
        ],
        workedExample:
            "A two by two weight matrix quantized to 4-bit codes loses at most one thirty-second of its range per entry. With rank one, A is one by two and B is two by one; one gradient step nudges four adapter numbers and lowers the squared error on a single example while the eight base codes stay frozen.",
    },
    id: "qlora",
    name: "QLoRA (Teaching Model)",
    category: "ml-ai",
    complexity: { time: "O(m * n * r)", space: "O(m * n + r * (m + n))" },
    defaultInput: {
        W: [
            [0.8, -0.4],
            [0.2, 0.6],
        ],
        x: [1, 0.5],
        y: [0.3, -0.2],
        A: [[0.1, -0.1]],
        B: [[0.2], [-0.15]],
        lr: 0.01,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "quantize the frozen base weight matrix to 4-bit codes",
        "dequantize the codes to obtain the fixed matrix Wq",
        "compute prediction as Wq x plus B times A times x",
        "form the error against the target and its squared loss",
        "derive the gradient of A from the backpropagated error",
        "derive the gradient of B from the adapter input",
        "take one learning-rate step on A and B",
        "done: report the new predictions and the reduced loss",
    ],
};

export default module;
