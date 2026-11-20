/**
 * gated-linear-unit.ts - Gated Linear Unit (GLU)
 *
 * A GLU splits a linear projection into two halves and uses one half as a
 * sigmoid gate on the other: y = (xW1) * sigmoid(xW2). The gate lets the
 * network control how much of each feature passes through, which often
 * trains better than a plain ReLU on language and audio tasks.
 *
 * Time O(rows * in * out), space O(rows * out) for the result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

export interface GluRow {
    linear: number[];
    gateLogit: number[];
    gate: number[];
    output: number[];
}

/** Compute y = (xW1) * sigmoid(xW2) row by row. */
export function gluForward(x: Matrix, w1: Matrix, w2: Matrix): GluRow[] {
    return x.map((row) => {
        const linear: number[] = [];
        const gateLogit: number[] = [];
        const gate: number[] = [];
        const output: number[] = [];
        for (let j = 0; j < (w1[0]?.length ?? 0); j += 1) {
            let a = 0;
            let b = 0;
            for (let i = 0; i < row.length; i += 1) {
                a += (row[i] ?? 0) * (w1[i]?.[j] ?? 0);
                b += (row[i] ?? 0) * (w2[i]?.[j] ?? 0);
            }
            const g = 1 / (1 + Math.exp(-b));
            linear.push(a);
            gateLogit.push(b);
            gate.push(g);
            output.push(a * g);
        }
        return { linear, gateLogit, gate, output };
    });
}

function makeCells(rows: GluRow[], revealed: number): VisualEntity[] {
    const labels = ["linear", "gate logit", "sigmoid", "GLU"];
    const entities: VisualEntity[] = [];
    rows.forEach((row, r) => {
        const values = [row.linear, row.gateLogit, row.gate, row.output];
        labels.forEach((label, c) => {
            const shown = r <= revealed;
            const vec = values[c] ?? [];
            const state: EntityState = shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: shown ? `${label}: [${vec.map((v) => v.toFixed(2)).join(", ")}]` : "?",
                value: shown ? vec : 0,
                state,
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
    const x = task.x ?? [[1, 2], [3, -1]];
    const w1 = task.w1 ?? [[1, 0], [0, 1]];
    const w2 = task.w2 ?? [[0.5, -0.5], [-0.5, 0.5]];
    const rows = gluForward(x, w1, w2);
    const cols = 4;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1),
        edges: [],
        description: `Apply a GLU to ${rows.length} rows: one projection is gated by a sigmoid of the other.`,
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
            description: `Row ${i}: linear ${rows[i]?.linear.map((v) => v.toFixed(2)).join(",")}, gate ${rows[i]?.gate.map((v) => v.toFixed(2)).join(",")}, output ${rows[i]?.output.map((v) => v.toFixed(2)).join(",")}.`,
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
        description: "Done: each output is the linear projection scaled by a learned sigmoid gate.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: rows.length, cols, outputs: rows.flatMap((r) => r.output), outCols: (w1[0]?.length ?? 0), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A gated linear unit computes an ordinary linear projection, then multiplies it element by element with a sigmoid of a second projection. The second projection acts as a set of soft switches that decide how much of each feature to keep. This lets a layer select information instead of merely thresholding it.",
        invariants: [
            "Each gate is a sigmoid, so it lies strictly between zero and one.",
            "An output coordinate is the linear coordinate times its matching gate.",
            "With a gate near one the GLU behaves like a linear layer; near zero it suppresses the feature.",
        ],
        correctness:
            "The implementation forms a = x times W1 and b = x times W2 with direct dot products, computes the gate as one divided by one plus exp of minus b, and returns a times the gate coordinate by coordinate. This is exactly the definition of the GLU, so a brute-force recomputation of the same dot products reproduces every output value.",
        complexityRationale:
            "For rows inputs, input size d, and output size m, each of the two projections costs O(rows * d * m) and the elementwise gate costs O(rows * m), giving O(rows * d * m) time. Storing the rows of outputs uses O(rows * m) space.",
        uses: [
            "Language modeling feed-forward blocks in gated architectures",
            "Convolutional and recurrent gating mechanisms",
            "Speech recognition networks",
        ],
        references: [
            "Dauphin, Fan, Auli, and Grangier, Language Modeling with Gated Convolutional Networks, ICML 2017",
            "Shazeer, GLU Variants Improve Transformer, arXiv 2020",
        ],
        workedExample:
            "With x = [1, 2], W1 = [[1, 0], [0, 1]], and W2 = [[0.5, -0.5], [-0.5, 0.5]], the linear projection is [1, 2] and the gate logits are [-0.5, 0.5]. The gates are about 0.379 and 0.622, so the GLU output is about [0.379, 1.244].",
    },
    id: "gated-linear-unit",
    name: "Gated Linear Unit",
    category: "ml-ai",
    complexity: { time: "O(rows * d * m)", space: "O(rows * m)" },
    defaultInput: { x: [[1, 2], [3, -1]], w1: [[1, 0], [0, 1]], w2: [[0.5, -0.5], [-0.5, 0.5]] },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input row x",
        "compute linear projection a = x times W1",
        "compute gate logits b = x times W2",
        "compute gate g = sigmoid(b) and output a times g",
        "store the linear value, logit, gate, and output",
        "done: report the gated outputs",
    ],
};

export default module;
