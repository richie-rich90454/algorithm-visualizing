/**
 * geglu-activation.ts - GeGLU Activation
 *
 * GeGLU is a gated linear unit whose gate uses the Gaussian Error Linear Unit
 * instead of a sigmoid or Swish. For each coordinate it computes
 * y = (xW1) * GELU(xW2), where GELU(z) = z * Phi(z) and Phi is the standard
 * normal cumulative distribution. The tanh form of Phi keeps it fast.
 *
 * Time O(rows * d * m), space O(rows * m) for the outputs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

const SQRT_2_OVER_PI = 0.7978845608028654;

/** GELU via the standard tanh approximation of the normal CDF. */
export function gelu(z: number): number {
    const inner = SQRT_2_OVER_PI * (z + 0.044715 * z * z * z);
    return 0.5 * z * (1 + Math.tanh(inner));
}

export interface GegluRow {
    up: number[];
    gate: number[];
    activated: number[];
    output: number[];
}

/** Compute y = (xW1) * GELU(xW2) row by row. */
export function gegluForward(x: Matrix, w1: Matrix, w2: Matrix): GegluRow[] {
    return x.map((row) => {
        const up: number[] = [];
        const gate: number[] = [];
        const activated: number[] = [];
        const output: number[] = [];
        for (let j = 0; j < (w1[0]?.length ?? 0); j += 1) {
            let a = 0;
            let b = 0;
            for (let i = 0; i < row.length; i += 1) {
                a += (row[i] ?? 0) * (w1[i]?.[j] ?? 0);
                b += (row[i] ?? 0) * (w2[i]?.[j] ?? 0);
            }
            const g = gelu(b);
            up.push(a);
            gate.push(b);
            activated.push(g);
            output.push(a * g);
        }
        return { up, gate, activated, output };
    });
}

function makeCells(rows: GegluRow[], revealed: number): VisualEntity[] {
    const labels = ["up xW1", "gate xW2", "GELU", "GeGLU"];
    const entities: VisualEntity[] = [];
    rows.forEach((row, r) => {
        const values = [row.up, row.gate, row.activated, row.output];
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
    const rows = gegluForward(x, w1, w2);
    const cols = 4;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1),
        edges: [],
        description: `GeGLU on ${rows.length} rows: gate an up-projection with a Gaussian Error Linear Unit.`,
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
            description: `Row ${i}: up ${rows[i]?.up.map((v) => v.toFixed(2)).join(",")}, GELU ${rows[i]?.activated.map((v) => v.toFixed(2)).join(",")}, output ${rows[i]?.output.map((v) => v.toFixed(2)).join(",")}.`,
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
        description: "Done: GeGLU scales the up-projection by a smooth Gaussian gate.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: rows.length, cols, outputs: rows.flatMap((r) => r.output), outCols: (w1[0]?.length ?? 0), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "GeGLU is a GLU where the gate is GELU, a smooth activation equal to z times the probability that a standard normal variable is at most z. Like SwiGLU it uses two parallel projections, but the Gaussian gate has a different shape that some models find easier to optimize. It is a common drop-in replacement in transformer feed-forward layers.",
        invariants: [
            "GELU is computed with the standard tanh approximation of the normal CDF.",
            "For large positive z the gate approaches z; for large negative z it approaches zero.",
            "Every output coordinate is the up-projection times its matching GELU gate.",
        ],
        correctness:
            "The program computes a = x times W1 and b = x times W2 with explicit dot products, evaluates GELU(b) as b/2 times one plus tanh of sqrt(2/pi) times b plus 0.044715 times b cubed, and returns a times that gate. This is exactly the documented GeGLU definition and the tanh approximation, so an independent brute-force evaluation reproduces every output.",
        complexityRationale:
            "Two matrix projections of rows inputs cost O(rows * d * m) each, the GELU and product cost O(rows * m), so total time is O(rows * d * m) with O(rows * m) space for the result.",
        uses: [
            "Transformer feed-forward blocks in modern language models",
            "Gated activation layers in vision models",
            "Drop-in replacement for ReLU-based gated units",
        ],
        references: [
            "Hendrycks and Gimpel, Gaussian Error Linear Units (GELUs), arXiv 2016",
            "Shazeer, GLU Variants Improve Transformer, arXiv 2020",
        ],
        workedExample:
            "With x = [1, 2], W1 as the identity, and W2 = [[1, -1], [0.5, 2]], the up-projection is [1, 2] and the gate logits are [2, 3]. GELU(2) is about 1.95 and GELU(3) about 3.0, giving a GeGLU output of about [1.95, 5.99].",
    },
    id: "geglu-activation",
    name: "GeGLU Activation",
    category: "ml-ai",
    complexity: { time: "O(rows * d * m)", space: "O(rows * m)" },
    defaultInput: { x: [[1, 2], [0, -1]], w1: [[1, 0], [0, 1]], w2: [[1, -1], [0.5, 2]] },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input row x",
        "compute up projection a = x times W1",
        "compute gate projection b = x times W2",
        "compute GELU(b) using the tanh approximation",
        "multiply a by GELU(b) to obtain the output",
        "done: report the GeGLU outputs",
    ],
};

export default module;
