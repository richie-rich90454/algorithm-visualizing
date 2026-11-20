/**
 * swiglu-activation.ts - SwiGLU Activation
 *
 * SwiGLU replaces the ReLU of a transformer feed-forward block with a Swish
 * gate multiplied by a second linear projection: y = (xW1) * (xW2 * sigmoid(xW2)).
 * It is used in PaLM, Llama, and many modern large language models.
 *
 * Time O(rows * d * m), space O(rows * m) for the outputs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

export interface SwigluRow {
    up: number[];
    gate: number[];
    swish: number[];
    output: number[];
}

function swish(x: number): number {
    return x / (1 + Math.exp(-x));
}

/** Compute y = (xW1) * swish(xW2) row by row. */
export function swigluForward(x: Matrix, w1: Matrix, w2: Matrix): SwigluRow[] {
    return x.map((row) => {
        const up: number[] = [];
        const gate: number[] = [];
        const swishVals: number[] = [];
        const output: number[] = [];
        for (let j = 0; j < (w1[0]?.length ?? 0); j += 1) {
            let a = 0;
            let b = 0;
            for (let i = 0; i < row.length; i += 1) {
                a += (row[i] ?? 0) * (w1[i]?.[j] ?? 0);
                b += (row[i] ?? 0) * (w2[i]?.[j] ?? 0);
            }
            const s = swish(b);
            up.push(a);
            gate.push(b);
            swishVals.push(s);
            output.push(a * s);
        }
        return { up, gate, swish: swishVals, output };
    });
}

function makeCells(rows: SwigluRow[], revealed: number): VisualEntity[] {
    const labels = ["up xW1", "gate xW2", "Swish", "SwiGLU"];
    const entities: VisualEntity[] = [];
    rows.forEach((row, r) => {
        const values = [row.up, row.gate, row.swish, row.output];
        labels.forEach((label, c) => {
            const shown = r <= revealed;
            const vec = values[c] ?? [];
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: shown ? `${label}: [${vec.map((v) => v.toFixed(2)).join(", ")}]` : "?",
                value: shown ? vec : 0,
                state: shown ? "sorted" : "idle",
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
    const task = (input as Partial<{ x: Matrix; w1: Matrix; w2: Matrix }> | null) ?? {};
    const x = task.x ?? [[1, 2], [0, -1]];
    const w1 = task.w1 ?? [[1, 0], [0, 1]];
    const w2 = task.w2 ?? [[1, -1], [0.5, 2]];
    const rows = swigluForward(x, w1, w2);
    const cols = 4;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1),
        edges: [],
        description: `SwiGLU on ${rows.length} rows: multiply an up-projection by a Swish-gated projection.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: rows.length, cols, outputs: rows.flatMap((r) => r.output), outCols: (w1[0]?.length ?? 0) },
    };
    step += 1;
    for (let i = 0; i < rows.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(rows, i),
            edges: [],
            description: `Row ${i}: up ${rows[i]?.up.map((v) => v.toFixed(2)).join(",")}, Swish gate ${rows[i]?.swish.map((v) => v.toFixed(2)).join(",")}, output ${rows[i]?.output.map((v) => v.toFixed(2)).join(",")}.`,
            codeLineNumber: i === 0 ? 1 : 3,
            layout: "grid",
            meta: { rows: rows.length, cols, current: i, outputs: rows.flatMap((r) => r.output), outCols: (w1[0]?.length ?? 0) },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(rows, rows.length - 1),
        edges: [],
        description: "Done: SwiGLU gates each up-projection with a smooth Swish gate.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: rows.length, cols, outputs: rows.flatMap((r) => r.output), outCols: (w1[0]?.length ?? 0), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SwiGLU is a feed-forward activation that replaces a single ReLU with two learned projections, one of which passes through a Swish gate before multiplying the other. The gate gives the layer a smooth, data-dependent switch for each channel. Empirically it improves the parameter efficiency of large transformer feed-forward blocks.",
        invariants: [
            "The up-projection and gate projection are independent linear maps of the same input.",
            "The Swish gate is x times its logistic sigmoid.",
            "Each output is the up-projection coordinate times the matching Swish gate.",
        ],
        correctness:
            "The code forms a = x times W1 and b = x times W2 using explicit dot products, computes Swish(b) = b divided by one plus exp of minus b, and multiplies a by that value elementwise. This is the exact SwiGLU definition, so any independent recomputation of the two projections and the Swish function yields identical outputs.",
        complexityRationale:
            "Projecting rows inputs of width d to width m costs O(rows * d * m) for each of the two matrices, and the gating is O(rows * m), so total time is O(rows * d * m). The result matrix uses O(rows * m) space.",
        uses: [
            "Feed-forward blocks in Llama and PaLM language models",
            "Gated transformer language modeling",
            "Parameter-efficient large model architectures",
        ],
        references: [
            "Shazeer, GLU Variants Improve Transformer, arXiv 2020",
            "Touvron et al., Llama: Open and Efficient Foundation Language Models, arXiv 2023",
        ],
        workedExample:
            "For x = [1, 2], W1 = identity, and W2 = [[1, -1], [0.5, 2]], the up-projection is [1, 2] and the gate logits are [2, 3]. Swish(2) is about 1.76 and Swish(3) about 2.86, so the SwiGLU output is about [1.76, 5.72].",
    },
    id: "swiglu-activation",
    name: "SwiGLU Activation",
    category: "ml-ai",
    complexity: { time: "O(rows * d * m)", space: "O(rows * m)" },
    defaultInput: { x: [[1, 2], [0, -1]], w1: [[1, 0], [0, 1]], w2: [[1, -1], [0.5, 2]] },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input row x",
        "compute up projection a = x times W1",
        "compute gate projection b = x times W2",
        "compute Swish(b) = b divided by one plus exp of minus b",
        "multiply a by Swish(b) to obtain the output",
        "done: report the SwiGLU outputs",
    ],
};

export default module;
