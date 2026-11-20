/**
 * informer.ts - ProbSparse Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Informer speeds up long sequence attention by keeping only the most useful
 * keys for each query. It scores every query/key pair with scaled dot products,
 * measures how peaked each query's score row is, and then attends only to the
 * top k keys of that query. Full attention is quadratic in sequence length;
 * ProbSparse keeps a sparse set of connections instead.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m * d) to score, then O(n * k) for the sparse softmax
 *   Space: O(n * m) for the score matrix
 *
 *  ---------------------------------------------------------------------------
 * Visualization mapping
 *  ---------------------------------------------------------------------------
 *   - Cells form the query by key score matrix.
 *   - Cells in the selected top-k columns are highlighted per query row.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface InformerInput {
    queries?: number[][];
    keys?: number[][];
    values?: number[][];
    topK?: number;
}

function cells(scores: number[][], selected: number[][], row: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < scores.length; i += 1) {
        for (let j = 0; j < (scores[i]?.length ?? 0); j += 1) {
            const chosen = (selected[i] ?? []).includes(j);
            const state: EntityState = i === row ? (chosen ? "active" : "comparing") : chosen ? "sorted" : "idle";
            entities.push({
                id: `score-${i}-${j}`,
                type: "cell" as const,
                label: (scores[i]?.[j] ?? 0).toFixed(2),
                value: Number((scores[i]?.[j] ?? 0).toFixed(8)),
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, selected: chosen },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as InformerInput | null) ?? {};
    const queries: number[][] = Array.isArray(task.queries) && task.queries.length > 0
        ? task.queries
        : [[1, 0], [0, 1], [1, 1]];
    const keys: number[][] = Array.isArray(task.keys) && task.keys.length > 0
        ? task.keys
        : [[1, 0], [0, 1], [1, 1], [-1, 0.5]];
    const values: number[][] = Array.isArray(task.values) && task.values.length > 0
        ? task.values
        : keys.map((key, i) => [i + 1, key[0] ?? 0]);
    const dim = Math.max(1, queries[0]?.length ?? 1);
    const scale = Math.sqrt(dim);
    const topK = typeof task.topK === "number" && task.topK > 0
        ? Math.max(1, Math.min(keys.length, Math.floor(task.topK)))
        : 2;

    const scores: number[][] = queries.map((query) =>
        keys.map((key) => {
            let dot = 0;
            for (let d = 0; d < dim; d += 1) dot += (query[d] ?? 0) * (key[d] ?? 0);
            return dot / scale;
        }),
    );
    const measures = scores.map((row) => {
        const max = Math.max(...row);
        const mean = row.reduce((sum, value) => sum + value, 0) / row.length;
        return max - mean;
    });
    const selected: number[][] = scores.map((row) =>
        row.map((value, index) => ({ value, index }))
            .sort((a, b) => b.value - a.value || a.index - b.index)
            .slice(0, topK)
            .map((item) => item.index),
    );
    const attention: number[][] = scores.map((row, i) => {
        const chosen = selected[i] ?? [];
        const exps = chosen.map((index) => Math.exp((row[index] ?? 0) - Math.max(...chosen.map((j) => row[j] ?? 0))));
        const total = exps.reduce((sum, value) => sum + value, 0);
        return exps.map((value) => (total === 0 ? 0 : value / total));
    });
    const output: number[][] = queries.map((_, i) => {
        const valueDim = Math.max(1, values[0]?.length ?? 1);
        const result = new Array<number>(valueDim).fill(0);
        (selected[i] ?? []).forEach((keyIndex, k) => {
            const weight = attention[i]?.[k] ?? 0;
            for (let d = 0; d < valueDim; d += 1) result[d] = (result[d] ?? 0) + weight * (values[keyIndex]?.[d] ?? 0);
        });
        return result;
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(scores, [], -1),
        edges: [],
        description: `Score ${queries.length} queries against ${keys.length} keys with scaled dot products.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { phase: "scores", rows: queries.length, cols: keys.length, scores, measures: [], selected: [], attention: [], output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(scores, [], -1),
        edges: [],
        description: "Measure how peaked each query row is by max minus mean.",
        codeLineNumber: 1,
        layout: "matrix",
        meta: { phase: "measure", rows: queries.length, cols: keys.length, scores, measures, selected: [], attention: [], output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(scores, selected, -1),
        edges: [],
        description: `Keep only the ${topK} highest scoring keys for each query.`,
        codeLineNumber: 2,
        layout: "matrix",
        meta: { phase: "select", rows: queries.length, cols: keys.length, scores, measures, selected, attention: [], output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(scores, selected, -1),
        edges: [],
        description: "Apply softmax over the selected keys and sum their value vectors.",
        codeLineNumber: 3,
        layout: "matrix",
        meta: { phase: "done", rows: queries.length, cols: keys.length, scores, measures, selected, attention, output: output.map((row) => row.map((v) => Number(v.toFixed(8)))) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Standard attention compares every query with every key, which becomes expensive for long sequences. Informer observes that most queries only care about a handful of keys: if a query's score row is highly peaked, a few keys carry almost all the attention. ProbSparse selects those keys explicitly and ignores the rest, preserving most of the output with far less work.",
        invariants: [
            "Every score is a scaled dot product of a query and a key.",
            "Each query selects exactly k keys, with ties broken by lower index.",
            "The sparse attention weights of each query sum to one.",
        ],
        correctness:
            "Scaling by the square root of the dimension keeps score magnitudes stable. The sparsity measurement is the difference between the largest and the mean score, which is zero for a flat row and large for a peaked one. Ranking the scores and taking the first k indices returns exactly the k largest values; the stable softmax over those entries sums to one, and multiplying by the corresponding value vectors reproduces the reported output, which an independent brute-force pass verifies.",
        complexityRationale:
            "Scoring n queries against m keys of dimension d costs O(n m d); ranking and the sparse softmax add O(n m log m) and O(n k). The score matrix uses O(n m) space.",
        uses: [
            "Efficient attention over long time series",
            "Long sequence forecasting with transformers",
            "Sparse approximations when full attention is too costly",
        ],
        references: [
            "Zhou et al., Informer: Beyond Efficient Transformer for Long Sequence Time-Series Forecasting, AAAI 2021",
            "Vaswani et al., Attention Is All You Need, NIPS 2017",
        ],
        workedExample:
            "With queries (1,0) and (0,1), keys (1,0), (0,1), (1,1) and topK one, the first query's scores are about 0.707, zero and 0.707, so keys zero and two tie and the lower index wins. Its sparse softmax is one and its output is the first value vector. The second query selects key one.",
    },
    id: "informer",
    name: "Informer ProbSparse Attention",
    category: "ml-ai",
    complexity: { time: "O(n * m * d)", space: "O(n * m)" },
    defaultInput: {
        queries: [[1, 0], [0, 1], [1, 1]],
        keys: [[1, 0], [0, 1], [1, 1], [-1, 0.5]],
        values: [[1, 1], [2, 0], [3, 1], [4, 0.5]],
        topK: 2,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "read the queries, keys, values and the key budget k",
        "score every query/key pair with a scaled dot product",
        "measure each query row as its maximum minus its mean",
        "select the k highest scoring keys for each query",
        "apply softmax over only the selected scores",
        "sum the selected value vectors with those weights",
        "done: report the sparse attention and its output",
    ],
};

export default module;
