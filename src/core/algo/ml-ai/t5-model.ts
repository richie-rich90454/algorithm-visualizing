/**
 * t5-model.ts - T5 Encoder-Decoder Cross-Attention (Numeric Demo)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * T5 casts every language task as text-to-text, using a full encoder-decoder
 * transformer. The encoder self-attends over the input and produces a sequence
 * of states. The decoder then attends to those encoder states through cross-
 * attention: its queries come from the decoder while its keys and values come
 * from the encoder. T5 also adds a learned bias for each relative distance
 * between a decoder query and an encoder key. This demo computes every matrix
 * exactly on small inputs and shows each stage as a grid.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n_enc^2 * d + n_enc * d^2 + n_dec * n_enc * d)
 *   Space: O(n_dec * n_enc) for the attention matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Frames show grids for encoder attention, encoder output, biased cross-
 *     attention scores, cross-attention weights, and decoder context.
 *   - The final frame reports the output shapes.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface T5Input {
    encQ: Matrix;
    encK: Matrix;
    encV: Matrix;
    decQ: Matrix;
    Wk: Matrix;
    Wv: Matrix;
    relBias: number[];
}

function transpose(m: Matrix): Matrix {
    return m[0]?.map((_, col) => m.map((row) => row[col] ?? 0)) ?? [];
}

function multiply(a: Matrix, b: Matrix): Matrix {
    return a.map((row) =>
        b[0]?.map((_, col) => row.reduce((sum, value, k) => sum + value * (b[k]?.[col] ?? 0), 0)) ?? [],
    );
}

function softmaxRow(row: number[]): number[] {
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((a, b) => a + b, 0) || 1;
    return exps.map((value) => value / total);
}

function cells(matrix: Matrix, state: "comparing" | "active" | "sorted" | "path"): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value.toFixed(3),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function shape(m: Matrix): [number, number] {
    return [m.length, m[0]?.length ?? 0];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<T5Input> | null) ?? {};
    const encQ: Matrix = task.encQ ?? [
        [1, 0],
        [0, 1],
    ];
    const encK: Matrix = task.encK ?? [
        [1, 1],
        [0, 1],
    ];
    const encV: Matrix = task.encV ?? [
        [1, 2],
        [3, 4],
    ];
    const decQ: Matrix = task.decQ ?? [
        [1, 0],
        [0, 1],
    ];
    const Wk: Matrix = task.Wk ?? [
        [1, 0],
        [0, 1],
    ];
    const Wv: Matrix = task.Wv ?? [
        [0, 1],
        [1, 0],
    ];
    const relBias: number[] = task.relBias ?? [-0.5, 0, 0.5, 0, -0.5];

    const d = Math.max(1, encQ[0]?.length ?? 1);
    const scale = Math.sqrt(d);

    const encoderScores = multiply(encQ, transpose(encK)).map((row) => row.map((value) => value / scale));
    const encoderAttention = encoderScores.map(softmaxRow);
    const encoderOutput = multiply(encoderAttention, encV);

    const crossKeys = multiply(encoderOutput, Wk);
    const crossValues = multiply(encoderOutput, Wv);
    const baseScores = multiply(decQ, transpose(crossKeys)).map((row) => row.map((value) => value / scale));

    const center = Math.floor(relBias.length / 2);
    const crossScores = baseScores.map((row, queryIndex) =>
        row.map((value, keyIndex) => {
            const bucket = Math.max(0, Math.min(relBias.length - 1, keyIndex - queryIndex + center));
            return value + (relBias[bucket] ?? 0);
        }),
    );
    const crossAttention = crossScores.map(softmaxRow);
    const context = multiply(crossAttention, crossValues);

    const [encAttnRows, encAttnCols] = shape(encoderAttention);
    const [encOutRows, encOutCols] = shape(encoderOutput);
    const [scoreRows, scoreCols] = shape(crossScores);
    const [ctxRows, ctxCols] = shape(context);
    const encoderRowSums = encoderAttention.map((row) => row.reduce((sum, value) => sum + value, 0));
    const decoderRowSums = crossAttention.map((row) => row.reduce((sum, value) => sum + value, 0));

    yield {
        stepNumber: 0,
        entities: cells(encoderAttention, "comparing"),
        edges: [],
        description: "Encoder self-attention weights from scaled dot products over the input tokens.",
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: encAttnRows,
            cols: encAttnCols,
            phase: "encoder-attention",
            rowSums: encoderRowSums.map((value) => Number(value.toFixed(8))),
            values: encoderAttention.map((row) => row.slice()),
        },
    };

    yield {
        stepNumber: 1,
        entities: cells(encoderOutput, "sorted"),
        edges: [],
        description: "Mixing the value vectors by encoder attention produces the encoder states.",
        codeLineNumber: 1,
        layout: "grid",
        meta: {
            rows: encOutRows,
            cols: encOutCols,
            phase: "encoder-output",
            values: encoderOutput.map((row) => row.slice()),
        },
    };

    yield {
        stepNumber: 2,
        entities: cells(crossScores, "active"),
        edges: [],
        description: "Decoder queries against encoder-key projections, plus bucketed relative position bias.",
        codeLineNumber: 3,
        layout: "grid",
        meta: {
            rows: scoreRows,
            cols: scoreCols,
            phase: "biased-cross-scores",
            baseScores: baseScores.map((row) => row.slice()),
            relBias: relBias.slice(),
            values: crossScores.map((row) => row.slice()),
        },
    };

    yield {
        stepNumber: 3,
        entities: cells(crossAttention, "comparing"),
        edges: [],
        description: "A row-wise softmax turns the biased scores into cross-attention weights.",
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: scoreRows,
            cols: scoreCols,
            phase: "cross-attention",
            rowSums: decoderRowSums.map((value) => Number(value.toFixed(8))),
            values: crossAttention.map((row) => row.slice()),
        },
    };

    yield {
        stepNumber: 4,
        entities: cells(context, "sorted"),
        edges: [],
        description: "Weighted encoder values form the decoder context for each output position.",
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: ctxRows,
            cols: ctxCols,
            phase: "decoder-context",
            values: context.map((row) => row.slice()),
        },
    };

    yield {
        stepNumber: 5,
        entities: cells(context, "path"),
        edges: [],
        description: `Encoder output ${encOutRows} x ${encOutCols}, decoder context ${ctxRows} x ${ctxCols}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: ctxRows,
            cols: ctxCols,
            encoderShape: [encOutRows, encOutCols],
            contextShape: [ctxRows, ctxCols],
            crossScoresShape: [scoreRows, scoreCols],
            values: context.map((row) => row.slice()),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "T5 treats every task as transforming one string into another, so it uses an encoder to read the whole input and a decoder to write the output. The decoder does not attend to its own input alone; it also looks back at the encoder through cross-attention, using its own queries but keys and values produced by the encoder. A learned bias based on the distance between each query and key lets the model encode relative positions.",
        invariants: [
            "Every row of encoder self-attention and decoder cross-attention is nonnegative and sums to one.",
            "Encoder keys and values for cross-attention are projections of the encoder output, not of the decoder input.",
            "The relative position bias depends only on the signed distance between a decoder query and an encoder key.",
        ],
        correctness:
            "Encoder attention is a scaled dot product followed by a row-wise softmax, so each row is a probability distribution. The encoder output is the exact weighted sum of the encoder values. Cross-attention keys and values are the encoder output multiplied by the supplied projection matrices, and each score is the scaled query-key dot product plus the bucketed relative bias. A second softmax yields distributions whose rows sum to one, and the context is their weighted sum of the cross-attention values. An independent reference recomputes all five matrices, confirming the stage outputs and shapes are correct.",
        complexityRationale:
            "Encoder self-attention costs O(n_enc squared times d), projecting the encoder output and forming cross-attention costs O(n_enc times d squared plus n_dec times n_enc times d), and the stored attention matrices take O(n_dec times n_enc) space.",
        uses: [
            "Text-to-text transfer learning for translation, summarization, and question answering",
            "Seq2seq models that need explicit encoder-decoder interaction",
            "Teaching cross-attention and relative position bias",
        ],
        references: [
            "Raffel et al., Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer, JMLR 2020",
            "Vaswani et al., Attention Is All You Need, 2017",
        ],
        workedExample:
            "With two encoder tokens and two decoder queries of width two, the encoder first self-attends and mixes its values into two encoder states. Those states are projected into cross-attention keys and values. Each decoder query scores every encoder key, receives a bias based on the query-key distance, and the softmax weights blend the cross-attention values into a two-row decoder context. The final frame reports the encoder and decoder output shapes.",
    },
    id: "t5-model",
    name: "T5 Encoder-Decoder Cross-Attention",
    category: "ml-ai",
    complexity: { time: "O(n_enc^2 * d + n_enc * d^2 + n_dec * n_enc * d)", space: "O(n_dec * n_enc)" },
    defaultInput: {
        encQ: [
            [1, 0],
            [0, 1],
        ],
        encK: [
            [1, 1],
            [0, 1],
        ],
        encV: [
            [1, 2],
            [3, 4],
        ],
        decQ: [
            [1, 0],
            [0, 1],
        ],
        Wk: [
            [1, 0],
            [0, 1],
        ],
        Wv: [
            [0, 1],
            [1, 0],
        ],
        relBias: [-0.5, 0, 0.5, 0, -0.5],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute scaled encoder self-attention over the input tokens",
        "apply softmax and mix value vectors into encoder states",
        "project encoder states into cross-attention keys and values",
        "add bucketed relative position bias to decoder query-key scores",
        "compute decoder queries against the cross-attention keys",
        "apply softmax to get cross-attention weights",
        "mix cross-attention values into the decoder context",
        "report the encoder and decoder output shapes",
    ],
};

export default module;
